// P8-7: buildReport gives the Report of spec/phases/phase-08.md "Report" from the facts and
// the ads' ends. One table per field.
import { describe, expect, it } from 'vitest'
import { buildReport, type ReportRun } from '@/main/export/report/build'
import type { FactVariant, ReportFacts } from '@/main/export/report/facts'
import type { VariantOutcome } from '@/main/export/types'
import { Report, type ReportCheck } from '@/shared/schemas/report'

const ROOT = '/Users/someone/Exports/Summer ads'

function variant(id: string, over: Partial<FactVariant> = {}): FactVariant {
  return {
    id,
    title: `Can ${id}`,
    sizeLabel: '1x1',
    language: 'en',
    format: 'image',
    rev: 3,
    agentChangedAt: null,
    subjectIds: ['s1'],
    textLayers: [{ key: 'headline', translationSource: null, translationStatus: null }],
    assets: [],
    ...over,
  }
}

function facts(over: Partial<ReportFacts> = {}): ReportFacts {
  return {
    campaign: {
      id: 'c1',
      name: 'Summer Splash',
      region: 'US',
      audience: 'Families',
      primaryLanguage: 'en',
      languages: ['en', 'de'],
      sizeLabels: ['1x1'],
    },
    subjects: [{ subjectId: 's1', displayName: 'Can' }],
    variants: [variant('pass'), variant('warn'), variant('fail')],
    previous: null,
    reportCount: 0,
    paidCount: { pictures: 2, videos: 1, text: 4 },
    exporterName: 'Sam Example',
    appVersion: '0.1.0',
    ...over,
  }
}

const done = (variantId: string): VariantOutcome => ({
  variantId,
  rev: 3,
  file: `c1/Can/1x1/en-${variantId}.png`,
  failure: null,
  picture: null,
})
const failed = (variantId: string): VariantOutcome => ({
  variantId,
  rev: null,
  file: null,
  failure: 'The ad could not be drawn.',
  picture: null,
})

const warnCheck = (message: string): ReportCheck => ({
  checkId: 'text-overflow',
  group: 'readiness',
  status: 'warn',
  findings: [{ layerId: 'l1', message }],
})
const passCheck: ReportCheck = {
  checkId: 'text-overflow',
  group: 'readiness',
  status: 'pass',
  findings: [],
}

function run(over: Partial<ReportRun> = {}): ReportRun {
  return {
    createdAt: '2026-11-21T10:00:00.000Z',
    root: ROOT,
    checksRun: true,
    checks: new Map([
      ['pass', [passCheck]],
      ['warn', [warnCheck('Seen text')]],
      ['fail', [warnCheck('Failed ad text')]],
    ]),
    warningsSeen: [{ variantId: 'warn', checkId: 'text-overflow', message: 'Seen text' }],
    proceeded: { at: '2026-11-21T09:59:00.000Z', reason: 'Client asked for it' },
    ...over,
  }
}

const outcomes = [done('pass'), done('warn'), failed('fail')]
const build = (f = facts(), o = outcomes, r = run()) => buildReport(f, o, r)

describe('buildReport', () => {
  it('gives a body the Report schema accepts', () => {
    expect(Report.safeParse(build()).success).toBe(true)
  })

  it('counts pass, warn and failed ads [FR-231]', () => {
    expect(build().summary).toEqual({ exported: 2, passedAll: 1, withWarnings: 1, failed: 1 })
  })

  it.each([
    ['a warning the gate showed', run(), true],
    ['a warning that appeared after the start [A-204]', run({ warningsSeen: [] }), false],
  ])('lists warnings of exported ads only: %s', (_, r, seen) => {
    expect(build(facts(), outcomes, r).warningsExportedPast).toEqual([
      { variantId: 'warn', checkId: 'text-overflow', message: 'Seen text', seenBeforeExport: seen },
    ])
  })

  it.each([
    ['a name', 'Sam Example', 'Sam Example'],
    ['an empty name', '', null],
  ])('sets the exporter from %s [FR-235]', (_, name, expected) => {
    const report = build(facts({ exporterName: name }))
    expect(report.exporter).toEqual({ name: expected })
    expect(report.proceeded?.by).toBe(expected)
  })

  it('records who proceeded, when and why, or null when no one did [FR-236]', () => {
    expect(build().proceeded).toEqual({
      by: 'Sam Example',
      at: '2026-11-21T09:59:00.000Z',
      reason: 'Client asked for it',
    })
    expect(build(facts(), outcomes, run({ proceeded: null })).proceeded).toBeNull()
  })

  it.each([
    ['null in the main language', variant('pass'), null],
    [
      'one entry per text layer in another language',
      variant('pass', {
        language: 'de',
        textLayers: [
          { key: 'headline', translationSource: 'ai', translationStatus: 'approved' },
          { key: 'cta', translationSource: null, translationStatus: 'missing' },
        ],
      }),
      [
        { layerKey: 'headline', source: 'ai', status: 'approved' },
        { layerKey: 'cta', source: null, status: 'missing' },
      ],
    ],
  ])('gives translations %s [FR-237]', (_, v, expected) => {
    const report = build(facts({ variants: [v] }), [done('pass')])
    expect(report.variants[0]?.translations).toEqual(expected)
  })

  it.each([
    [null, null],
    ['2026-11-20T08:00:00.000Z', '2026-11-20T08:00:00.000Z'],
  ])('carries the last agent change %s [FR-239]', (at, expected) => {
    const report = build(facts({ variants: [variant('pass', { agentChangedAt: at })] }), [
      done('pass'),
    ])
    expect(report.variants[0]?.lastAgentChangeAt).toBe(expected)
  })

  it('holds the output folder name only, never the full path [A-196]', () => {
    const report = build()
    expect(report.outputFolderName).toBe('Summer ads')
    expect(JSON.stringify(report)).not.toContain('/Users/someone')
  })

  it('fills the header from the facts [FR-230, FR-234]', () => {
    const report = build(facts({ reportCount: 2 }))
    expect(report).toMatchObject({
      reportVersion: 1,
      campaignId: 'c1',
      campaignName: 'Summer Splash',
      createdAt: '2026-11-21T10:00:00.000Z',
      appVersion: '0.1.0',
      exportNumber: 3,
      market: 'US',
      audience: 'Families',
      primaryLanguage: 'en',
      paidGenerations: { pictures: 2, videos: 1, text: 4 },
      checksRun: true,
    })
  })

  it('gives each ad its facts, file, checks and failure in the outcomes order', () => {
    const report = build()
    expect(report.variants.map((v) => v.variantId)).toEqual(['pass', 'warn', 'fail'])
    expect(report.variants[0]).toMatchObject({
      title: 'Can pass',
      sizeLabel: '1x1',
      format: 'image',
      rev: 3,
      subjects: [{ subjectId: 's1', displayName: 'Can' }],
      file: 'c1/Can/1x1/en-pass.png',
      checks: [passCheck],
      failure: null,
    })
    expect(report.variants[2]).toMatchObject({ file: null, failure: 'The ad could not be drawn.' })
  })

  it('marks changes against the previous export from the second export on [FR-238]', () => {
    const previous = { ...build(), exportNumber: 1 }
    const next = build(
      facts({ previous, reportCount: 1, variants: [variant('pass', { rev: 4 }), variant('new')] }),
      [{ ...done('pass'), rev: 4 }, done('new')],
    )
    expect(next.previousExport).toEqual({ exportNumber: 1, createdAt: previous.createdAt })
    expect(next.variants.map((v) => v.changedSincePrevious)).toEqual(['changed', 'not_in_previous'])
    expect(build().previousExport).toBeNull()
    expect(build().variants[0]?.changedSincePrevious).toBeNull()
  })

  it('leaves out an ad deleted before the facts were read and counts it as failed', () => {
    const report = build(facts(), [...outcomes, failed('gone')])
    expect(report.variants.map((v) => v.variantId)).toEqual(['pass', 'warn', 'fail'])
    expect(report.summary.failed).toBe(2)
  })

  it('lists the pairs asked for and not delivered [FR-232]', () => {
    expect(build().missing).toEqual([{ sizeLabel: '1x1', language: 'de', reason: 'no_variant' }])
  })
})
