// P8-1 (spec/phases/phase-08-slices.md, "P8-1 — Contracts"): every Phase 8 command, query, job
// kind and port is registered against a stub. A stub checks its input, then refuses before it
// reads or writes anything. The agent rows are final now. Each later slice removes exactly its
// own rows from the tables below when it fills its stub.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { exportCommands } from '@/main/commands/export'
import { reportQueries } from '@/main/queries/report'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { exportKind } from '@/main/jobs/kinds/export'
import { createExportDeps } from '@/main/export/deps'
import { createExportPictures } from '@/main/export/picture-encoder'
import { ProviderFailure } from '@/main/providers/types'
import { registerIpc, IPC } from '@/main/ipc'
import { REPORT_QUERY_DENIED } from '@/shared/export/messages'
import { ok } from '@/shared/schemas/result'
import { sampleReport } from '../../unit/shared/schemas/report-sample'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

const refusal = (message: string, reason: string) => ({
  ok: false,
  error: { code: 'RULE_VIOLATION', message, details: { reason } },
})

// One row per stub command: a good input without projectId, the stub's answer, its policy,
// whether it is internal, and an input its schema refuses.
type CommandRow = {
  name: string
  input: object
  answer: object
  policy: 'deny'
  internal: boolean
  bad: object
}
const COMMANDS: CommandRow[] = [
  {
    name: 'export.run',
    input: {
      campaignId: 'C1',
      variantIds: ['V1'],
      outputDir: '/nowhere/Exports',
      imageFormat: 'png',
      jpgQuality: 90,
      fps: 30,
      proceedDespiteWarnings: false,
    },
    answer: refusal('Export is not built yet.', 'export_not_built'),
    policy: 'deny',
    internal: false,
    bad: { campaignId: 'C1', variantIds: [] },
  },
  {
    name: 'report.add',
    input: { campaignId: 'C1', outputDir: '/nowhere/Exports', report: sampleReport() },
    answer: refusal('report.add is not built yet.', 'not_built'),
    policy: 'deny',
    internal: true,
    bad: { campaignId: 'C1', outputDir: '', report: sampleReport() },
  },
]

// One row per stub query: a good input without projectId (campaignId filled in), its answer to
// the user.
type QueryRow = { name: string; input: (campaignId: string) => object; answer: object }
const QUERIES: QueryRow[] = [
  { name: 'report.list', input: (campaignId) => ({ campaignId }), answer: ok([]) },
  {
    name: 'report.get',
    input: () => ({ reportId: 'R1' }),
    answer: { ok: false, error: { code: 'NOT_FOUND', message: 'That report was not found.' } },
  },
]

describe('Phase 8 registration [P8-1]', () => {
  it('registers the export commands and the report queries on core', async () => {
    const { fx } = await open()
    const deps = fx.core.deps
    expect(exportCommands(deps).map((h) => h.name)).toEqual(['export.run', 'report.add'])
    expect(Object.keys(reportQueries(deps))).toEqual(['report.list', 'report.get'])
    expect(fx.core.commandNames).toEqual(expect.arrayContaining(['export.run', 'report.add']))
    expect(fx.core.queryNames).toEqual(expect.arrayContaining(['report.list', 'report.get']))
  })

  it('has one handler for the export job kind', () => {
    expect(jobKindHandlers.filter((h) => h.kind === 'export')).toHaveLength(1)
  })

  it.each(COMMANDS)('$name has its own policy row', ({ name, policy }) => {
    expect(AGENT_POLICY[name]?.policy).toBe(policy)
  })

  it.each(COMMANDS)('$name is internal exactly when it is a system command', async (row) => {
    const { fx } = await open()
    expect(fx.core.isInternal(row.name)).toBe(row.internal)
  })
})

describe('the Phase 8 command stubs [P8-1]', () => {
  it.each(COMMANDS)('$name as the user refuses and writes nothing', async (row) => {
    const { fx, projectId } = await open()
    const before = fx.events.length
    expect(await fx.user(row.name, { projectId, ...row.input })).toEqual(row.answer)
    expect(fx.events.slice(before)).toEqual([])
  })

  it.each(COMMANDS)('$name checks its input before the stub answers', async (row) => {
    const { fx, projectId } = await open()
    expect(await fx.user(row.name, { projectId, ...row.bad })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it.each(COMMANDS)('$name as the agent is AGENT_DENIED', async (row) => {
    const { fx, projectId } = await open()
    expect(await fx.agent(row.name, { projectId, ...row.input })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(row.name) },
    })
  })

  it('answers a window that sends an internal command as unknown, and runs nothing', async () => {
    const { fx, projectId } = await open()
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    const handlers = new Map<string, Handler>()
    const sent: string[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: (name, input, opts) => {
          sent.push(name)
          return fx.core.bus.execute(name, input, opts)
        },
        query: async () => ok(null),
        isInternal: (name) => fx.core.isInternal(name),
        mayCall: () => true,
      },
    )
    const command = handlers.get(IPC.command)
    for (const row of COMMANDS.filter((r) => r.internal)) {
      expect(await command?.({}, row.name, { projectId, ...row.input })).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: `Unknown command: ${row.name}` },
      })
    }
    expect(sent).toEqual([])
  })
})

describe('the Phase 8 query stubs [P8-1]', () => {
  async function withCampaign() {
    const { fx, projectId } = await open()
    const made = await fx.user('campaign.create', { projectId, ...createInput() })
    return { fx, projectId, campaignId: data<{ campaignId: string }>(made).campaignId }
  }

  it.each(QUERIES)('$name answers the user', async (row) => {
    const { fx, projectId, campaignId } = await withCampaign()
    const input = { projectId, ...row.input(campaignId) }
    expect(await fx.core.query(row.name, input, { actor: 'user' })).toEqual(row.answer)
  })

  it.each(QUERIES)('$name refuses the agent before it reads the input', async (row) => {
    const { fx, projectId, campaignId } = await withCampaign()
    const denied = { ok: false, error: { code: 'AGENT_DENIED', message: REPORT_QUERY_DENIED } }
    const input = { projectId, ...row.input(campaignId) }
    expect(await fx.core.query(row.name, input, { actor: 'agent' })).toEqual(denied)
    expect(await fx.core.query(row.name, { extra: 1 }, { actor: 'agent' })).toEqual(denied)
  })

  it.each(QUERIES)('$name checks the input', async (row) => {
    const { fx, projectId, campaignId } = await withCampaign()
    const input = { projectId, ...row.input(campaignId), extra: 1 }
    expect(await fx.core.query(row.name, input, { actor: 'user' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('the Phase 8 job kind and port stubs [P8-1]', () => {
  it('fails an export job as other, with its sentence', async () => {
    const run = exportKind().run({} as never, {} as never)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    await expect(run).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Export is not built yet.' },
    })
  })

  it('answers no checks for every variant and says the checks were not run', async () => {
    const { fx } = await open()
    const ports = createExportDeps(() => fx.core.deps)
    expect(ports.checks.checksRun).toBe(false)
    const results = await ports.checks.run({} as never, ['V1', 'V2'])
    expect([...results.entries()]).toEqual([
      ['V1', []],
      ['V2', []],
    ])
  })

  it('refuses a video ad, writes no report and draws nothing', async () => {
    const { fx } = await open()
    const ports = createExportDeps(() => fx.core.deps)
    const video = ports.video.exportVariant({} as never, {} as never, {} as never, {} as never, 'a')
    await expect(video).rejects.toThrow('Video export is not built yet.')
    await expect(
      ports.report.write({} as never, {} as never, {} as never, [], new Map()),
    ).resolves.toBeNull()
    await expect(fx.core.deps.render.drawFull({} as never)).rejects.toThrow()
  })

  it('keeps a plan once: take gives it and removes it, drop removes it', async () => {
    const { fx } = await open()
    const { plans } = fx.core.deps.export
    const plan = { campaignId: 'C1' } as never
    plans.set('J1', plan)
    plans.set('J2', plan)
    expect(plans.take('J1')).toBe(plan)
    expect(plans.take('J1')).toBeNull()
    plans.drop('J2')
    expect(plans.take('J2')).toBeNull()
  })

  it('has picture encoder members that each throw until P8-4', () => {
    const pictures = createExportPictures(
      () => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) }) as never,
      () => ({}) as never,
    )
    const png = new Uint8Array(1)
    expect(() => pictures.toJpeg(png, 80)).toThrow('not built')
    expect(() => pictures.stitch([], { width: 1, height: 1 })).toThrow('not built')
    expect(() => pictures.shrink(png, 240)).toThrow('not built')
  })
})

describe('what the Phase 8 contracts keep out of logs and replies [P8-1, A-196, A-201]', () => {
  it('puts no folder path in a stub refusal or a log line', async () => {
    const { fx, projectId } = await open()
    const replies = []
    for (const row of COMMANDS) {
      replies.push(await fx.user(row.name, { projectId, ...row.input }))
      replies.push(await fx.agent(row.name, { projectId, ...row.input }))
    }
    expect(JSON.stringify(replies)).not.toContain('/nowhere')
    expect(fx.readLogs()).not.toContain('/nowhere')
  })

  it('saves the exporter name through settings.update and logs none of it', async () => {
    const { fx } = await open()
    const saved = await fx.user('settings.update', { reports: { exporterName: ' Sam Rivera ' } })
    expect(saved).toMatchObject({ ok: true })
    expect(fx.core.settings.get().reports).toEqual({ exporterName: 'Sam Rivera' })
    expect(fx.readLogs()).not.toContain('Sam Rivera')
    expect(await fx.agent('settings.update', { reports: { exporterName: 'X' } })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})
