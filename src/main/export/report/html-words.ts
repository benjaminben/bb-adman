// The report page's fixed words (spec/phases/phase-08.md "Report", words). The sentences the
// in-app view shares live in src/shared/export/messages.ts; this file holds the page's own
// headings and labels and re-exports the shared ones, so the page reads its words from here.
import type { CheckId, CheckStatus } from '@/shared/schemas/checks'
import type { ReportVariant } from '@/shared/schemas/report'

export {
  CHANGED_WORDS,
  MISSING_WORDS,
  REPORT_WORDS,
  SOURCE_WORDS,
  STATUS_WORDS,
  WARNING_AFTER_START,
  lastAgentChange,
} from '@/shared/export/messages'

export const HEADINGS = {
  page: 'Export report',
  summary: 'Summary',
  warnings: 'Warnings exported past',
  delivered: 'Asked for against delivered',
} as const

export const LABELS = {
  campaign: 'Campaign',
  market: 'Market',
  audience: 'Audience',
  campaignId: 'Campaign ID',
  exportedAt: 'Exported at',
  exporter: 'Exported by',
  exportNumber: 'Export number',
  appVersion: 'App version',
  paid: 'Paid generations',
  exported: 'Exported',
  passedAll: 'Passed every check',
  withWarnings: 'With warnings',
  failed: 'Failed',
  ad: 'Ad',
  check: 'Check',
  warning: 'Warning',
  proceededBy: 'Exported past it by',
  proceededAt: 'When',
  reason: 'Reason',
  size: 'Size',
  language: 'Language',
  why: 'Why',
  id: 'ID',
  format: 'Format',
  file: 'File',
  subjects: 'Subjects',
  changed: 'Changed',
  agent: 'Last agent change',
  translations: 'Translations',
  checks: 'Checks',
  assets: 'Assets',
  failure: 'Failure',
  provider: 'Provider',
  model: 'Model',
  prompt: 'Prompt',
} as const

export const NOTES = {
  noWarnings: 'No warnings were exported past.',
  allDelivered: 'Every size and language asked for was delivered.',
  noFile: 'no file',
  none: 'none',
  noFindings: 'no findings',
  noPicture: 'No picture.',
} as const

export const paidLine = (paid: { pictures: number; videos: number; text: number }) =>
  `pictures ${paid.pictures}, videos ${paid.videos}, text ${paid.text}`

export const FORMAT_WORDS: Record<ReportVariant['format'], string> = {
  image: 'Picture',
  video: 'Video',
}

export const ROLE_WORDS: Record<ReportVariant['assets'][number]['role'], string> = {
  background: 'background',
  image: 'picture',
  font: 'font',
  clip: 'clip',
}

export const ORIGIN_WORDS: Record<ReportVariant['assets'][number]['origin'], string> = {
  generated: 'generated',
  imported: 'imported',
}

export const CHECK_NAMES: Record<CheckId, string> = {
  'required-assets': 'Required files',
  'text-colours': 'Text colours',
  'prohibited-words': 'Prohibited words',
  'required-words': 'Required words',
  'unapproved-translations': 'Unapproved translations',
  'text-overflow': 'Text overflow',
}

export const CHECK_STATUS_WORDS: Record<CheckStatus, string> = {
  pass: 'passed',
  warn: 'warning',
  skipped: 'skipped',
}
