// The in-app report view's words (spec/phases/phase-08.md "Report", words). The sentences the
// HTML file shares come from src/shared/export/messages.ts; the headings and labels below are
// the same as the HTML file's (src/main/export/report/html-words.ts), which the window cannot
// import, so the view reads like the file. Pure.
import type { CheckId, CheckStatus } from '@/shared/schemas/checks'
import type { ReportVariant } from '@/shared/schemas/report'
import { REPORT_WORDS } from '@/shared/export/messages'

export {
  CHANGED_WORDS,
  MISSING_WORDS,
  REPORT_WORDS,
  SOURCE_WORDS,
  STATUS_WORDS,
  WARNING_AFTER_START,
  lastAgentChange,
} from '@/shared/export/messages'

const PROMPT_LIMIT = 2000

export const HEADINGS = {
  page: 'Export report',
  summary: 'Summary',
  details: 'Details',
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

// "YYYY-MM-DD HH:mm UTC". A time that does not parse is shown as it was stored.
export function utcTime(stored: string): string {
  const time = new Date(stored)
  if (Number.isNaN(time.getTime())) return stored
  return `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

// A-206: a long prompt is cut by whole characters, as in the HTML file.
export function shownPrompt(prompt: string): string {
  const chars = Array.from(prompt)
  if (chars.length <= PROMPT_LIMIT) return prompt
  return `${chars.slice(0, PROMPT_LIMIT).join('')} ${REPORT_WORDS.promptCut}`
}
