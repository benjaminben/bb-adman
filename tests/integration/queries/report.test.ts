// P8-9 (spec/phases/phase-08.md "Report", saved and queries): report.add saves one report row;
// report.list answers a campaign's reports newest first, report.get one report. Both queries
// are for the user only (A-196: they hold the output folder's full path). A row comes from a
// project file that may be crafted: a body that fails the schema is logged with no values and
// left out (list) or NOT_FOUND (get).
import { afterEach, describe, expect, it } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from '../checks/check-fixture'
import { sampleReport } from '../../unit/shared/schemas/report-sample'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { REPORT_NOT_FOUND, REPORT_QUERY_DENIED } from '@/shared/export/messages'
import type { ReportListItem } from '@/shared/schemas/queries/report'
import type { Report } from '@/shared/schemas/report'

const DIR = '/Users/someone/Deliveries/Spring'
const USER = { actor: 'user' as const }
const AGENT = { actor: 'agent' as const }

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function setup(): Promise<{ fx: Fixture; p: CheckProject }> {
  const fx = makeFixture()
  f = fx
  return { fx, p: await openCheckProject(fx) }
}

function reportFor(p: CheckProject, createdAt: string, exportNumber: number): Report {
  return { ...sampleReport(), campaignId: p.campaignId, createdAt, exportNumber }
}

async function add(fx: Fixture, p: CheckProject, report: Report, outputDir = DIR) {
  const input = { projectId: p.projectId, campaignId: p.campaignId, outputDir, report }
  return data<{ reportId: string }>(await fx.user('report.add', input)).reportId
}

const list = (fx: Fixture, p: CheckProject, opts = USER) =>
  fx.core.query('report.list', { projectId: p.projectId, campaignId: p.campaignId }, opts)
const get = (fx: Fixture, p: CheckProject, reportId: string, opts = USER) =>
  fx.core.query('report.get', { projectId: p.projectId, reportId }, opts)

describe('report.add saves one report row [P8-9]', () => {
  it('stores the body, the time and the real root, and answers the new ID', async () => {
    const { fx, p } = await setup()
    const report = reportFor(p, '2026-11-21T10:00:00.000Z', 1)
    const reportId = await add(fx, p, report)
    const row = p.db().prepare('SELECT * FROM report WHERE id = ?').get(reportId) as Record<
      string,
      string
    >
    expect(row).toMatchObject({
      campaign_id: p.campaignId,
      created_at: report.createdAt,
      output_dir: DIR,
    })
    expect(JSON.parse(row.body)).toEqual(report)
  })

  it('refuses a campaign that is not in the project, and a body of another campaign', async () => {
    const { fx, p } = await setup()
    const report = reportFor(p, '2026-11-21T10:00:00.000Z', 1)
    const base = { projectId: p.projectId, outputDir: DIR }
    expect(
      await fx.user('report.add', {
        ...base,
        campaignId: 'gone-campaign-abc234',
        report: { ...report, campaignId: 'gone-campaign-abc234' },
      }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(
      await fx.user('report.add', { ...base, campaignId: p.campaignId, report: sampleReport() }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(p.db().prepare('SELECT COUNT(*) AS n FROM report').get()).toEqual({ n: 0 })
  })

  it('is internal, and refused to an agent before it runs [A-196]', async () => {
    const { fx, p } = await setup()
    const input = {
      projectId: p.projectId,
      campaignId: p.campaignId,
      outputDir: DIR,
      report: reportFor(p, '2026-11-21T10:00:00.000Z', 1),
    }
    expect(fx.core.isInternal('report.add')).toBe(true)
    expect(AGENT_POLICY['report.add']?.policy).toBe('deny')
    expect(await fx.agent('report.add', input)).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(p.db().prepare('SELECT COUNT(*) AS n FROM report').get()).toEqual({ n: 0 })
  })

  it('sends no event, reply or log line that holds the output folder', async () => {
    const { fx, p } = await setup()
    const before = fx.events.length
    const reply = await fx.user('report.add', {
      projectId: p.projectId,
      campaignId: p.campaignId,
      outputDir: DIR,
      report: reportFor(p, '2026-11-21T10:00:00.000Z', 1),
    })
    expect(JSON.stringify(reply)).not.toContain(DIR)
    expect(JSON.stringify(fx.events.slice(before))).not.toContain(DIR)
    expect(fx.readLogs()).not.toContain(DIR)
  })
})

describe('report.list and report.get [P8-9]', () => {
  it('lists the campaign reports newest first, with their folder and summary', async () => {
    const { fx, p } = await setup()
    const first = await add(fx, p, reportFor(p, '2026-11-20T10:00:00.000Z', 1), '/Exports/A')
    const third = await add(fx, p, reportFor(p, '2026-11-22T10:00:00.000Z', 3), '/Exports/C')
    const second = await add(fx, p, reportFor(p, '2026-11-21T10:00:00.000Z', 2), '/Exports/B')
    const items = data<ReportListItem[]>(await list(fx, p))
    expect(items.map((i) => i.reportId)).toEqual([third, second, first])
    expect(items[0]).toEqual({
      reportId: third,
      createdAt: '2026-11-22T10:00:00.000Z',
      exportNumber: 3,
      outputDir: '/Exports/C',
      summary: sampleReport().summary,
    })
  })

  it('gives one report with its folder, and NOT_FOUND for an unknown ID', async () => {
    const { fx, p } = await setup()
    const report = reportFor(p, '2026-11-21T10:00:00.000Z', 1)
    const reportId = await add(fx, p, report)
    expect(data(await get(fx, p, reportId))).toEqual({ report, outputDir: DIR })
    expect(await get(fx, p, 'no-such-report')).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND },
    })
  })

  it('answers an empty list for a campaign with no export', async () => {
    const { fx, p } = await setup()
    expect(data(await list(fx, p))).toEqual([])
  })

  const DAMAGE: Array<{ name: string; sql: string; value: string }> = [
    { name: 'a body that is not JSON', sql: 'body', value: 'not json {secret-body-text' },
    {
      name: 'a body that fails the schema',
      sql: 'body',
      value: JSON.stringify({ reportVersion: 9, note: 'secret-body-text' }),
    },
    { name: 'an empty output folder', sql: 'output_dir', value: '' },
  ]

  it.each(DAMAGE)('logs $name with no values and leaves it out', async ({ sql, value }) => {
    const { fx, p } = await setup()
    const good = await add(fx, p, reportFor(p, '2026-11-20T10:00:00.000Z', 1))
    const bad = await add(fx, p, reportFor(p, '2026-11-21T10:00:00.000Z', 2), '/Exports/Hidden')
    p.db().prepare(`UPDATE report SET ${sql} = ? WHERE id = ?`).run(value, bad)
    expect(data<ReportListItem[]>(await list(fx, p)).map((i) => i.reportId)).toEqual([good])
    expect(await get(fx, p, bad)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    const logs = fx.readLogs()
    expect(logs).toContain('A saved report could not be read.')
    expect(logs).not.toContain('secret-body-text')
    expect(logs).not.toContain('/Exports/Hidden')
    expect(logs).not.toContain(DIR)
  })

  it('refuses the agent before anything is read, for both queries', async () => {
    const { fx, p } = await setup()
    const reportId = await add(fx, p, reportFor(p, '2026-11-21T10:00:00.000Z', 1))
    const denied = { ok: false, error: { code: 'AGENT_DENIED', message: REPORT_QUERY_DENIED } }
    expect(await list(fx, p, AGENT)).toEqual(denied)
    expect(await get(fx, p, reportId, AGENT)).toEqual(denied)
    expect(await fx.core.query('report.get', { extra: 1 }, AGENT)).toEqual(denied)
  })
})
