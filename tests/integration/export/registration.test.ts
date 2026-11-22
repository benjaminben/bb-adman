// P8-1 (spec/phases/phase-08-slices.md, "P8-1 — Contracts"): every Phase 8 command, query, job
// kind and port is registered against a stub. A stub checks its input, then refuses before it
// reads or writes anything. Each later slice removed its own rows when it filled its stub: the
// command and query stubs are all filled now (P8-5, P8-9), so what stays here is the
// registration, the internal-command rule and the ports still unfilled.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { exportCommands } from '@/main/commands/export'
import { reportQueries } from '@/main/queries/report'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'

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
})

describe('the Phase 8 internal command [P8-1]', () => {
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
    expect(fx.core.isInternal('report.add')).toBe(true)
    expect(await command?.({}, 'report.add', { projectId, campaignId: 'C1' })).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: report.add' },
    })
    expect(sent).toEqual([])
  })
})

describe('the Phase 8 job kind and port stubs [P8-1]', () => {
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
})

describe('what the Phase 8 contracts keep out of logs and replies [P8-1, A-196, A-201]', () => {
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
