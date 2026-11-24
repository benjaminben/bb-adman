// The app's six checks on one ad (spec/quickstart.md, "The checks in a run with no project").
// The rule set is the brief's word lists, the brand colours and the logo as a required file,
// built as campaign.create builds it. The layers carry the two facts the app keeps on its rows:
// whether a text overflows (as the drawing page measured it) and whether a translation is
// approved (copy from the brief is the user's own; an AI translation is not yet approved). Pure.
import { brandRuleSet } from '@/shared/brief/brand-rule-set'
import { wordsByLanguage } from '@/shared/brief/words'
import { runAllChecks } from '@/shared/checks/run-all'
import type { CheckInput, CheckResult } from '@/shared/checks/types'
import type { Brief } from '@/shared/schemas/brief'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { LOGO_ASSET, type Variant } from './layers'
import type { Plan } from './plan'

const primaryOf = (plan: Plan) => plan.languages[0] ?? ''

export function ruleSetOf(plan: Plan, logo: boolean): CheckInput['ruleSet'] {
  const words = (list: Brief['requiredWords']) =>
    list === undefined ? {} : wordsByLanguage(list, primaryOf(plan))
  const start = {
    requiredAssetIds: [],
    palette: [],
    requiredWords: words(plan.brief.requiredWords),
    prohibitedWords: words(plan.brief.prohibitedWords),
  }
  return brandRuleSet(start, plan.look.colours, logo ? LOGO_ASSET : undefined)
}

// The layers with the overflow as measured, keyed by layer ID, and the brief's copy approved.
export function checkedLayers(layers: LayerRow[], overflow: Record<string, boolean>): LayerRow[] {
  return layers.map((layer) => {
    const fromBrief = layer.translationSource === 'brief' && layer.translationStatus === 'proposed'
    return {
      ...layer,
      overflow: overflow[layer.id] === true,
      ...(fromBrief ? { translationStatus: 'approved' as const } : {}),
    }
  })
}

// logoName: the logo file's last part, or null when the run has no logo.
export function adChecks(
  plan: Plan,
  variant: Variant,
  overflow: Record<string, boolean>,
  logoName: string | null,
): CheckResult[] {
  const { size, language } = variant
  return runAllChecks({
    variant: { format: 'image', width: size.width, height: size.height, durationMs: 0, language },
    primaryLanguage: primaryOf(plan),
    layers: checkedLayers(variant.layers, overflow),
    ruleSet: ruleSetOf(plan, logoName !== null),
    assetNames: logoName === null ? {} : { [LOGO_ASSET]: logoName },
  })
}
