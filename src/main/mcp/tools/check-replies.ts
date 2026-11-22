// Allow-list pickers for run_checks and get_check_results (spec/phases/phase-10.md, A-236).
// Each names every field it passes on, at every depth, so a field added to a check row later
// cannot leave through MCP without a change here (FR-198). What goes out: check names, groups,
// statuses and the app's own sentences, which can quote a layer's name, its copy's matched
// word, an asset's display name or a colour, all things the agent can already read. A sentence
// is cut to MAX_FINDING_CHARS code points and a check keeps its first MAX_FINDINGS findings.
import type { CheckFinding, CheckResult } from '@/shared/schemas/checks'
import type { CheckRunReply } from '@/shared/schemas/commands/check'
import type { CheckResultsReply, VariantCheckState } from '@/shared/schemas/queries/check'
import type { ReplyPicker } from './read-replies'

export const MAX_FINDINGS = 50
export const MAX_FINDING_CHARS = 300

const cut = (text: string) => [...text].slice(0, MAX_FINDING_CHARS).join('')

const finding = (f: CheckFinding) => ({
  ...(f.layerId !== undefined && { layerId: f.layerId }),
  message: cut(f.message),
})

const result = (c: CheckResult) => ({
  checkId: c.checkId,
  group: c.group,
  status: c.status,
  findings: c.findings.slice(0, MAX_FINDINGS).map(finding),
})

const checkedVariant = (v: CheckRunReply['variants'][number]) => ({
  variantId: v.variantId,
  checkedRev: v.checkedRev,
  results: v.results.map(result),
})

const variantState = (v: VariantCheckState) => ({
  variantId: v.variantId,
  rev: v.rev,
  checkedRev: v.checkedRev,
  stale: v.stale,
  ranAt: v.ranAt,
  ranBy: v.ranBy,
  results: v.results.map(result),
})

export const checkRunFields: ReplyPicker = (data) => ({
  variants: (data as CheckRunReply).variants.map(checkedVariant),
})

export const checkResultsFields: ReplyPicker = (data) => ({
  variants: (data as CheckResultsReply).variants.map(variantState),
})
