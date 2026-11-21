// The export and report sentences and refusal reasons (spec/phases/phase-08.md "Design
// additions"). The one copy: commands, the job, the report and the screens import them from
// here. No sentence holds a path, a key or a value the user typed.
import { AppError } from '@/shared/schemas/result'

// details.reason of a RULE_VIOLATION, one sentence each.
export const EXPORT_REASONS = [
  'export_not_built',
  'output_dir_refused',
  'output_dir_missing',
  'export_not_retried',
  'export_running',
  'export_has_warnings',
] as const
export type ExportReason = (typeof EXPORT_REASONS)[number]

export const EXPORT_REASON_MESSAGES: Record<ExportReason, string> = {
  export_not_built: 'Export is not built yet.',
  output_dir_refused: 'Choose another folder: this one cannot be used for an export.',
  output_dir_missing: 'The chosen folder is not there any more. Choose it again.',
  export_not_retried: 'Run the export again from the Export dialog.',
  export_running: 'This campaign is already being exported. Wait for it to finish.',
  export_has_warnings: 'Some ads have warnings. Fix them or export anyway.',
}

// The RULE_VIOLATION for a reason, with its sentence. export_has_warnings also carries
// details.warnings (exportHasWarningsDetails), so its command builds that one itself.
export function exportRefusal(reason: Exclude<ExportReason, 'export_has_warnings'>): AppError {
  return new AppError('RULE_VIOLATION', EXPORT_REASON_MESSAGES[reason], { reason })
}

// NOT_FOUND sentences.
export const EXPORT_VARIANT_NOT_FOUND = 'That ad is not in this campaign.'
export const REPORT_NOT_FOUND = 'That report was not found.'

// AGENT_DENIED for report.list and report.get: they hold the output folder's full path (A-196).
export const REPORT_QUERY_DENIED =
  'Agents cannot read export reports in this version. Ask the user to do it in the app.'

// One ad's failure in the job and the report ("Export run").
export const AD_FAILURES = {
  deleted: 'This ad was deleted before it was exported.',
  notDrawn: 'The ad could not be drawn.',
  notWritten: 'The file could not be written.',
  videoNotBuilt: 'Video export is not built yet.',
  videoNotMade: 'The video could not be made.',
  videoSystem: 'Video export works on macOS and Windows only.',
} as const

// "A file this ad uses is missing: {display names}.", the names joined with ", " and the whole
// cut to 200 characters.
export function missingFilesMessage(displayNames: string[]): string {
  return `A file this ad uses is missing: ${displayNames.join(', ')}.`.slice(0, 200)
}

// A-204: a warning the gate did not see.
export const WARNING_AFTER_START = 'This warning appeared after the export was started.'

// The job's own failures.
export const REPORT_NOT_SAVED = 'The report was written but could not be saved in the project.'

// The export dialog (A-193).
export const OVERWRITE_NOTE =
  'Files from an earlier export of the same ads are replaced. Nothing else in the folder is changed.'

// The report's fixed words ("Report", words), shared by the HTML file and the in-app view.
export const REPORT_WORDS = {
  nameNotSet: 'name not set',
  exporterNote: 'Typed by the user in Settings. Not checked.',
  noReason: 'no reason given',
  noAgentChanges: 'no agent changes',
  mainLanguage: 'Main language',
  checksNotRun: 'Checks were not run: not built in this version.',
  picturesInFile: 'Pictures of each ad are in the report file.',
  promptCut: '(cut)',
} as const

export const lastAgentChange = (date: string) => `last changed by an agent on ${date}`

export const CHANGED_WORDS = {
  changed: (n: number) => `Changed since export ${n}`,
  unchanged: (n: number) => `Not changed since export ${n}`,
  not_in_previous: (n: number) => `Not in export ${n}`,
} as const

export const MISSING_WORDS = {
  no_variant: 'No ad was made for this size and language.',
  not_in_export: 'Not part of this export.',
  export_failed: 'The export of this ad failed.',
} as const

export const SOURCE_WORDS = {
  ai: 'AI',
  agent: 'an agent',
  user: 'typed by the user',
  brief: 'supplied with the brief',
  none: 'not recorded',
} as const

export const STATUS_WORDS = {
  approved: 'approved',
  proposed: 'proposed, not approved',
  missing: 'missing',
} as const
