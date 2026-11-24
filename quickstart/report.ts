// report.json and the lines printed at the end of a run (spec/quickstart.md, "Output"): the
// models, the notes from the brief, each ad set with its prompt, pictures and AI calls, and each
// ad with the result of each check. It holds no key and no path from the brief. Pure.
import { relative, sep } from 'node:path'
import type { CheckResult } from '@/shared/checks/types'

export type CallKind = 'picture' | 'text placement' | 'translation' | 'extend'
export type CallRecord = { kind: CallKind; ms: number }

// A picture of a set: a photo the brief gave (by its last part), or one the model made.
export type PictureRecord = { from: 'given'; file: string } | { from: 'made'; size: string }

export type SetRecord = {
  name: string | null
  prompt: string
  pictures: PictureRecord[]
  calls: CallRecord[]
}

type CheckRecord = {
  id: CheckResult['checkId']
  group: CheckResult['group']
  state: 'passed' | 'flagged' | 'skipped'
  findings?: string[]
  reason?: string
}
export type AdRecord = { folder: string; checks: CheckRecord[] }

export type Report = {
  models: { image: string; text: string }
  notes: string[]
  sets: SetRecord[]
  ads: AdRecord[]
}

// An ad's folder inside the campaign folder, with / between its parts on every system.
export const relativeFolder = (campaign: string, folder: string) =>
  relative(campaign, folder).split(sep).join('/')

// Plain quotes in place of the curly ones the check messages use, so a line stays ASCII.
const plain = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")

function checkRecord(result: CheckResult): CheckRecord {
  const { checkId: id, group, findings } = result
  if (result.status === 'skipped') {
    return { id, group, state: 'skipped', reason: plain(findings[0]?.message ?? '') }
  }
  if (result.status === 'pass') return { id, group, state: 'passed' }
  return { id, group, state: 'flagged', findings: findings.map((f) => plain(f.message)) }
}

export const adRecord = (folder: string, results: CheckResult[]): AdRecord => ({
  folder,
  checks: results.map(checkRecord),
})

export const reportOf = (report: Report): Report => ({
  models: report.models,
  notes: report.notes,
  sets: report.sets,
  ads: report.ads,
})

const flagsOf = (ad: AdRecord) => ad.checks.flatMap((check) => check.findings ?? [])

// width: the longest folder of the run, so the results line up.
export function adLine(ad: AdRecord, width: number): string {
  const flags = flagsOf(ad)
  const result = flags.length === 0 ? 'all checks passed' : `flagged: ${flags.join(' ')}`
  return `  ${ad.folder.padEnd(width + 2)}${result}`
}

export function totalLine(ads: AdRecord[]): string {
  const flagged = ads.filter((ad) => flagsOf(ad).length > 0).length
  const noun = ads.length === 1 ? 'ad' : 'ads'
  return `${ads.length} ${noun}: ${ads.length - flagged} passed every check, ${flagged} flagged.`
}
