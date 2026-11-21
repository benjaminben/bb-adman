// P8-1 (spec/phases/phase-08-slices.md, spec/phases/phase-08.md "Export run", "Report"): the
// export.run and report.add inputs and the export_has_warnings details, each strict and bounded.
import { describe, it, expect } from 'vitest'
import {
  exportHasWarningsDetails,
  exportRunInput,
  reportAddInput,
} from '@/shared/schemas/commands/export'
import { sampleReport } from './report-sample'

const good = {
  projectId: 'P1',
  campaignId: 'C1',
  variantIds: ['V1', 'V2'],
  outputDir: '/Users/someone/Exports',
  imageFormat: 'jpg',
  jpgQuality: 85,
  fps: 30,
  proceedDespiteWarnings: false,
}

describe('export.run input [P8-1, "Export run"]', () => {
  it('passes a good input, with and without a reason', () => {
    expect(exportRunInput.safeParse(good).success).toBe(true)
    expect(exportRunInput.safeParse({ ...good, fps: 60, imageFormat: 'png' }).success).toBe(true)
    const withReason = exportRunInput.parse({ ...good, reason: '  Client asked for it.  ' })
    expect(withReason.reason).toBe('Client asked for it.')
  })

  it.each([
    ['projectId missing', { projectId: undefined }],
    ['campaignId empty', { campaignId: '' }],
    ['variantIds empty', { variantIds: [] }],
    ['variantIds repeated', { variantIds: ['V1', 'V1'] }],
    ['a variant ID empty', { variantIds: [''] }],
    ['outputDir empty', { outputDir: '' }],
    ['outputDir over 4,096 characters', { outputDir: `/${'a'.repeat(4096)}` }],
    ['imageFormat webp', { imageFormat: 'webp' }],
    ['jpgQuality 0', { jpgQuality: 0 }],
    ['jpgQuality 101', { jpgQuality: 101 }],
    ['jpgQuality 50.5', { jpgQuality: 50.5 }],
    ['fps 45', { fps: 45 }],
    ['proceedDespiteWarnings missing', { proceedDespiteWarnings: undefined }],
    ['reason of 501 characters', { reason: 'a'.repeat(501) }],
    ['reason with a control character', { reason: 'ok\u0007then' }],
    ['reason with a new line', { reason: 'line one\nline two' }],
    ['an unknown key', { extra: 1 }],
  ])('refuses %s', (_name, change) => {
    expect(exportRunInput.safeParse({ ...good, ...change }).success).toBe(false)
  })

  it('takes a 500-character reason once trimmed', () => {
    expect(exportRunInput.safeParse({ ...good, reason: ` ${'a'.repeat(500)} ` }).success).toBe(true)
  })
})

describe('export_has_warnings details [P8-1, "Export run"]', () => {
  const warning = { variantId: 'V1', checkId: 'prohibited-words', message: 'Has a word.' }

  it('passes the reason and the warnings', () => {
    const details = { reason: 'export_has_warnings', warnings: [warning] }
    expect(exportHasWarningsDetails.safeParse(details).success).toBe(true)
  })

  it.each([
    ['another reason', { reason: 'export_running', warnings: [warning] }],
    [
      'an unknown check',
      { reason: 'export_has_warnings', warnings: [{ ...warning, checkId: 'x' }] },
    ],
    [
      'a warning with an unknown key',
      { reason: 'export_has_warnings', warnings: [{ ...warning, x: 1 }] },
    ],
    ['an unknown key', { reason: 'export_has_warnings', warnings: [], extra: 1 }],
  ])('refuses %s', (_name, details) => {
    expect(exportHasWarningsDetails.safeParse(details).success).toBe(false)
  })
})

describe('report.add input [P8-1, "Report", saved]', () => {
  const add = { projectId: 'P1', campaignId: 'C1', outputDir: '/x/Exports', report: sampleReport() }

  it('passes a good input', () => {
    expect(reportAddInput.safeParse(add).success).toBe(true)
  })

  it.each([
    ['outputDir empty', { outputDir: '' }],
    ['a report with an unknown key', { report: { ...sampleReport(), extra: 1 } }],
    ['no report', { report: undefined }],
    ['an unknown key', { extra: 1 }],
  ])('refuses %s', (_name, change) => {
    expect(reportAddInput.safeParse({ ...add, ...change }).success).toBe(false)
  })
})
