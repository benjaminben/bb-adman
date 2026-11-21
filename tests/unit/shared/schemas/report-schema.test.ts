// P8-1 (spec/phases/phase-08.md "Report"): the Report schema is strict at every level, so a
// body read back from a project file with an unknown field is not trusted.
import { describe, it, expect } from 'vitest'
import { Report, ReportCheck } from '@/shared/schemas/report'
import { sampleReport } from './report-sample'

const variant = () => sampleReport().variants[0]!

describe('the Report schema [P8-1, "Report"]', () => {
  it('passes a full sample report', () => {
    expect(Report.parse(sampleReport())).toEqual(sampleReport())
  })

  it('passes a first export with nothing proceeded past', () => {
    const first = {
      ...sampleReport(),
      previousExport: null,
      proceeded: null,
      exporter: { name: null },
    }
    expect(Report.safeParse(first).success).toBe(true)
  })

  it.each([
    ['an unknown top-level field', { ...sampleReport(), outputDir: '/Users/someone/Exports' }],
    ['reportVersion 2', { ...sampleReport(), reportVersion: 2 }],
    [
      'an unknown summary field',
      { ...sampleReport(), summary: { ...sampleReport().summary, x: 1 } },
    ],
    ['an unknown variant field', { ...sampleReport(), variants: [{ ...variant(), path: '/a' }] }],
    [
      'an unknown asset field',
      {
        ...sampleReport(),
        variants: [{ ...variant(), assets: [{ ...variant().assets[0], path: '/a' }] }],
      },
    ],
    [
      'a missing reason outside the three',
      { ...sampleReport(), missing: [{ sizeLabel: 'a', language: 'en', reason: 'other' }] },
    ],
    ['a negative export number', { ...sampleReport(), exportNumber: -1 }],
    ['a fractional rev', { ...sampleReport(), variants: [{ ...variant(), rev: 1.5 }] }],
    [
      'a format outside image and video',
      { ...sampleReport(), variants: [{ ...variant(), format: 'gif' }] },
    ],
  ])('refuses %s', (_name, body) => {
    expect(Report.safeParse(body).success).toBe(false)
  })
})

describe('ReportCheck [P8-1, "Interfaces with other phases"]', () => {
  it('has the shape of a check result and refuses an unknown field', () => {
    const check = variant().checks[0]!
    expect(ReportCheck.safeParse(check).success).toBe(true)
    expect(ReportCheck.safeParse({ ...check, extra: 1 }).success).toBe(false)
    expect(ReportCheck.safeParse({ ...check, status: 'fail' }).success).toBe(false)
  })
})
