// Fan-out, step 6 (spec/phases/phase-06.md, section 7; design addition 2, "Status on new
// layers" and "Brief-supplied copy", A-163). Called by variant.fanOut inside its transaction:
// each new variant's text layers in another language start `missing`, the brief's copy for the
// language fills its slot (`proposed`, source `brief`), and then one translation job per
// language covers the rest, with the text provider from Settings. No provider that can
// translate, or no key: no job, the layers stay `missing`. An agent starts no job here (the
// policy table denies it variant.fanOut, and an agent may not start AI translation, A-169).
import type { ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import { AppError } from '@/shared/schemas/result'
import { translatedLayers } from '@/shared/translation/translated-layers'
import { enqueueTranslation } from './start'
import { planGroup, type TranslationPlan } from './targets'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets' | 'settings'>
export type NewVariant = { variantId: string; language: string }

// Lives in shared code, so the quickstart CLI fills copy the same way.
export { translatedLayers }

// The Settings text provider when it can translate now and has its key; otherwise null.
function textProvider(deps: Deps): ProviderInfo | null {
  const id = deps.settings.get().defaultProviders.text
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('text')) return null
  try {
    requireProviderKeys(deps, info.id, 'translate')
  } catch (error) {
    if (error instanceof AppError && error.code === 'NEEDS_KEY') return null
    throw error
  }
  return info
}

// The language's plan without the layers the brief filled: those are not the job's.
function planFor(
  ctx: ProjectContext,
  directionId: string,
  language: string,
  variantIds: string[],
): TranslationPlan | null {
  const db = ctx.project.db
  const plan = planGroup(db, { directionId, language, variantIds }, 'write')
  if (!plan) return null
  const sourceOf = db.prepare('SELECT translation_source AS source FROM layer WHERE id = ?')
  const targets = plan.request.targets.filter(
    (t) => (sourceOf.get(t.layerId) as { source: string | null }).source !== 'brief',
  )
  if (targets.length === 0) return null
  const keys = new Set(targets.map((t) => t.key))
  const items = plan.request.items.filter((i) => keys.has(i.key))
  return { ...plan, request: { ...plan.request, items, targets } }
}

// One job per language of the new variants; the IDs started.
export function startFanOutTranslations(
  deps: Deps,
  ctx: ProjectContext,
  source: { directionId: string; campaign: CampaignRow },
  made: NewVariant[],
): string[] {
  if (ctx.actor === 'agent') return []
  const { campaign, directionId } = source
  const byLanguage = new Map<string, string[]>()
  for (const { variantId, language } of made) {
    if (language === campaign.primaryLanguage) continue
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), variantId])
  }
  const plans = [...byLanguage]
    .map(([language, ids]) => planFor(ctx, directionId, language, ids))
    .filter((plan): plan is TranslationPlan => plan !== null)
  if (plans.length === 0) return []
  const provider = textProvider(deps)
  if (!provider) return []
  return plans.map((plan) => enqueueTranslation(deps, ctx, plan, provider, 'user'))
}
