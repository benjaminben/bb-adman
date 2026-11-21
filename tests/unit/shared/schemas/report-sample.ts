// A full sample report (spec/phases/phase-08.md "Report"), with every field set, for the
// schema tests. Made-up names only.
import type { Report } from '@/shared/schemas/report'

export function sampleReport(): Report {
  return {
    reportVersion: 1,
    campaignId: 'C1',
    campaignName: 'Summer sale',
    createdAt: '2026-11-21T10:00:00.000Z',
    appVersion: '0.1.0',
    outputFolderName: 'Exports',
    exportNumber: 2,
    exporter: { name: 'Sam Rivera' },
    market: 'DE',
    audience: 'Young families',
    primaryLanguage: 'en',
    paidGenerations: { pictures: 4, videos: 1, text: 2 },
    checksRun: true,
    proceeded: { by: 'Sam Rivera', at: '2026-11-21T09:59:00.000Z', reason: null },
    summary: { exported: 1, passedAll: 0, withWarnings: 1, failed: 1 },
    warningsExportedPast: [
      {
        variantId: 'V1',
        checkId: 'prohibited-words',
        message: 'Has a word.',
        seenBeforeExport: true,
      },
    ],
    missing: [{ sizeLabel: '1080x1920', language: 'en', reason: 'no_variant' }],
    previousExport: { exportNumber: 1, createdAt: '2026-11-20T10:00:00.000Z' },
    variants: [
      {
        variantId: 'V1',
        title: 'Summer sale',
        sizeLabel: '1080x1080',
        language: 'de',
        format: 'image',
        rev: 7,
        changedSincePrevious: 'changed',
        subjects: [{ subjectId: 'S1', displayName: 'Lemon soda' }],
        lastAgentChangeAt: '2026-11-21T08:00:00.000Z',
        translations: [
          { layerKey: 'headline', source: 'ai', status: 'approved' },
          { layerKey: 'cta', source: null, status: null },
        ],
        file: 'C1/Summer sale/1080x1080/de/V1.jpg',
        assets: [
          {
            assetId: 'A1',
            displayName: 'Beach',
            role: 'background',
            origin: 'generated',
            provider: 'fake',
            model: 'fake-image',
            prompt: 'A sunny beach',
          },
          { assetId: 'A2', displayName: 'Brand font', role: 'font', origin: 'imported' },
        ],
        checks: [
          {
            checkId: 'prohibited-words',
            group: 'brand-legal',
            status: 'warn',
            findings: [{ layerId: 'L1', message: 'Has a word.' }],
          },
        ],
        failure: null,
      },
      {
        variantId: 'V2',
        title: 'Summer sale',
        sizeLabel: '1080x1080',
        language: 'en',
        format: 'video',
        rev: 3,
        changedSincePrevious: 'not_in_previous',
        subjects: [],
        lastAgentChangeAt: null,
        translations: null,
        file: null,
        assets: [],
        checks: [],
        failure: 'Video export is not built yet.',
      },
    ],
  }
}
