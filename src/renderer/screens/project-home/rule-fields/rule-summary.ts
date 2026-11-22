// The Rules Section's summary (HOME-3a): "{n} required · {m} prohibited", counting the words
// "Create campaign" would send (one per non-blank line, for the listed languages only; a list
// with no language counts under the main one), or "From {campaign}" for a copy. A copy with no
// campaign chosen yet reads "Copy from". Pure.
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'

type Rules = BriefFormValues['rules']

function count(texts: Record<string, string>, languages: string[]): number {
  let n = 0
  for (const [tag, text] of Object.entries(texts)) {
    const key = tag === '' ? (languages[0] ?? '') : tag
    if (!languages.includes(key)) continue
    n += text.split('\n').filter((w) => w.trim() !== '').length
  }
  return n
}

export function ruleSummary(rules: Rules, languages: string[], campaigns: CampaignSummary[]) {
  if (rules.mode === 'copy') {
    const from = campaigns.find((c) => c.id === rules.copyFrom)
    return from ? `From ${from.name}` : 'Copy from'
  }
  const required = count(rules.requiredWords, languages)
  const prohibited = count(rules.prohibitedWords, languages)
  return `${required} required · ${prohibited} prohibited`
}
