// A-246 (spec/phases/phase-10.md, "Design additions"; spec/brief-and-templates.md, the MCP
// tool create_campaign): fills the sizes and languages an agent left out, before
// campaign.create runs. Sizes: the brief's own, read by parseSize, else the default sizes.
// Languages: the brief's own, else the region table's language; with neither they stay out
// and the command refuses the input as before. A brief size is only ever read as a size, so
// a path or an address in it is skipped and never followed. Pure.
import { parseSize } from '@/shared/brief/size'
import { primaryLanguageFor } from '@/shared/brief/languages'
import { READY_MADE_SIZES } from '@/shared/config/defaults'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'

type Input = Record<string, unknown>

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

const DEFAULT_SIZES = (): CampaignSize[] =>
  READY_MADE_SIZES.filter((s) => s.selectedByDefault).map(({ label, width, height }) => ({
    label,
    width,
    height,
  }))

function sizesOf(brief: Input): CampaignSize[] {
  const sizes: CampaignSize[] = []
  for (const text of strings(brief.sizes)) {
    const size = parseSize(text)
    if (size && !sizes.some((s) => s.label === size.label)) sizes.push(size)
  }
  return sizes.length > 0 ? sizes : DEFAULT_SIZES()
}

function languagesOf(brief: Input): string[] | null {
  const given = [...new Set(strings(brief.languages).map((l) => l.trim()))].filter(Boolean)
  if (given.length > 0) return given
  const language = typeof brief.region === 'string' ? primaryLanguageFor(brief.region) : null
  return language ? [language] : null
}

export function fillCreateDefaults(input: Input): Input {
  const brief = input.brief
  if (brief === null || typeof brief !== 'object' || Array.isArray(brief)) return { ...input }
  const out: Input = { ...input }
  if (out.sizes === undefined) out.sizes = sizesOf(brief as Input)
  if (out.languages === undefined) {
    const languages = languagesOf(brief as Input)
    if (languages) out.languages = languages
  }
  return out
}
