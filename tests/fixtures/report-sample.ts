// A sample export report (spec/phases/phase-08.md "Report") for the HTML tests: a second export
// with one picture ad passed, one video ad with a warning, one failed ad and one missing pair.
// Made-up names only.
import { Report } from '@/shared/schemas/report'

export const LONG_PROMPT = 'a quiet harbour at dawn, '.repeat(120).slice(0, 3000)

export const sampleReport: Report = Report.parse({
  reportVersion: 1,
  campaignId: '01JCAMPAIGN0000000000000001',
  campaignName: 'Spring Fizz Launch',
  createdAt: '2026-11-21T09:05:42.123Z',
  appVersion: '0.8.0',
  outputFolderName: 'exports',
  exportNumber: 2,
  exporter: { name: null },
  market: 'Northern Europe',
  audience: 'Adults who cycle to work',
  primaryLanguage: 'en',
  paidGenerations: { pictures: 4, videos: 1, text: 7 },
  checksRun: true,
  proceeded: { by: 'user', at: '2026-11-21T09:04:00.000Z', reason: null },
  summary: { exported: 2, passedAll: 1, withWarnings: 1, failed: 1 },
  warningsExportedPast: [
    {
      variantId: '01JVARIANT00000000000000002',
      checkId: 'prohibited-words',
      message: 'Headline contains “free”.',
      seenBeforeExport: true,
    },
  ],
  missing: [{ sizeLabel: 'Story 9:16', language: 'de', reason: 'no_variant' }],
  previousExport: { exportNumber: 1, createdAt: '2026-11-20T16:30:00.000Z' },
  variants: [
    {
      variantId: '01JVARIANT00000000000000001',
      title: '<img src=x onerror=alert(1)>',
      sizeLabel: 'Square 1:1',
      language: 'en',
      format: 'image',
      rev: 5,
      changedSincePrevious: 'changed',
      subjects: [{ subjectId: '01JSUBJECT00000000000000001', displayName: 'Lemon can' }],
      lastAgentChangeAt: null,
      translations: null,
      file: '01JCAMPAIGN0000000000000001/square-1-1/en/spring.jpg',
      assets: [
        {
          assetId: '01JASSET0000000000000000001',
          displayName: 'Harbour background',
          role: 'background',
          origin: 'generated',
          provider: 'fake',
          model: 'fake-image-1',
          prompt: LONG_PROMPT,
        },
        {
          assetId: '01JASSET0000000000000000002',
          displayName: 'Brand font',
          role: 'font',
          origin: 'imported',
        },
      ],
      checks: [{ checkId: 'text-overflow', group: 'readiness', status: 'pass', findings: [] }],
      failure: null,
    },
    {
      variantId: '01JVARIANT00000000000000002',
      title: 'Spring fizz, French video',
      sizeLabel: 'Square 1:1',
      language: 'fr',
      format: 'video',
      rev: 3,
      changedSincePrevious: 'unchanged',
      subjects: [],
      lastAgentChangeAt: '2026-11-19T22:15:09.000Z',
      translations: [{ layerKey: 'headline', source: 'agent', status: 'proposed' }],
      file: '01JCAMPAIGN0000000000000001/square-1-1/fr/spring.mp4',
      assets: [
        {
          assetId: '01JASSET0000000000000000003',
          displayName: 'Bubbles clip',
          role: 'clip',
          origin: 'generated',
          provider: 'fake',
          model: 'fake-video-1',
          prompt: 'bubbles rising </style><script>alert(1)</script>',
        },
      ],
      checks: [
        {
          checkId: 'prohibited-words',
          group: 'brand-legal',
          status: 'warn',
          findings: [
            { layerId: '01JLAYER0000000000000000001', message: 'Headline contains “free”.' },
          ],
        },
      ],
      failure: null,
    },
    {
      variantId: '01JVARIANT00000000000000003',
      title: 'Spring fizz, banner',
      sizeLabel: 'Banner 4:1',
      language: 'en',
      format: 'image',
      rev: 1,
      changedSincePrevious: 'not_in_previous',
      subjects: [],
      lastAgentChangeAt: null,
      translations: null,
      file: null,
      assets: [],
      checks: [],
      failure: 'The ad could not be drawn.',
    },
  ],
})

// Pictures for the two exported ads (stand-in bytes; the page only carries them).
export const samplePictures = new Map<string, Uint8Array>([
  ['01JVARIANT00000000000000001', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])],
  ['01JVARIANT00000000000000002', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6])],
])
