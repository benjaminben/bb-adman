import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { adChecks, checkedLayers, ruleSetOf } from '../../../quickstart/checks'
import {
  LOGO_ASSET,
  masterLayers,
  missingItems,
  planVariants,
  withTranslations,
  type Variant,
} from '../../../quickstart/layers'
import { readPlan } from '../../../quickstart/plan'

const example = (name: string) =>
  new URL(`../../../quickstart/examples/${name}/brief.yaml`, import.meta.url)
const BRAND = { logo: true, headingFont: true, bodyFont: true }
const PICTURE = { width: 1080, height: 1080 }

function planOf(name: string) {
  const result = readPlan(readFileSync(example(name), 'utf8'), 'yaml')
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

const find = (list: Variant[], language: string, size: string) => {
  const found = list.find((v) => v.language === language && v.size.label === size)
  if (!found) throw new Error(`no ${language} ${size}`)
  return found
}
const stateOf = (results: ReturnType<typeof adChecks>, id: string) =>
  results.find((r) => r.checkId === id)

describe('quickstart checks', () => {
  it("builds the rule set from the brief's words, the brand colours and the logo", () => {
    const plan = planOf('summer-splash')
    expect(ruleSetOf(plan, true)).toEqual({
      requiredAssetIds: [LOGO_ASSET],
      palette: ['#0B3D2E', '#FFF6E5', '#FFC83D'],
      requiredWords: {},
      prohibitedWords: { en: ['cheap'], de: ['billig'] },
    })
    expect(ruleSetOf(plan, false).requiredAssetIds).toEqual([])
  })

  it('reads a plain word list as the main language', () => {
    const text =
      'campaignName: A\nregion: US\naudience: B\nmessage: C\nsubjects:\n  - name: D\nlanguages: [fr, en]\nrequiredWords: [Paris]\n'
    const result = readPlan(text, 'yaml')
    if (!result.ok) throw new Error(result.message)
    expect(ruleSetOf(result.plan, false).requiredWords).toEqual({ fr: ['Paris'] })
  })

  it('sets the overflow as measured, and copy from the brief as approved', () => {
    const plan = planOf('summer-splash')
    const de = find(planVariants(plan, masterLayers(plan, BRAND), PICTURE), 'de', '1x1')
    const layers = checkedLayers(de.layers, { headline: true })
    const headline = layers.find((l) => l.key === 'headline')
    expect(headline?.overflow).toBe(true)
    expect(headline?.translationStatus).toBe('approved')
    expect(headline?.translationSource).toBe('brief')
    expect(layers.find((l) => l.key === 'call-to-action')?.overflow).toBe(false)
  })

  it('flags the banned German word and passes the logo, colours and English ads', () => {
    const plan = planOf('summer-splash')
    const list = planVariants(plan, masterLayers(plan, BRAND), PICTURE)
    const en = adChecks(plan, find(list, 'en', '16x9'), {}, 'logo.png')
    expect(en.filter((r) => r.status === 'warn')).toEqual([])
    expect(stateOf(en, 'required-assets')?.status).toBe('pass')
    expect(stateOf(en, 'text-colours')?.status).toBe('pass')
    expect(stateOf(en, 'unapproved-translations')?.status).toBe('skipped')
    const de = adChecks(plan, find(list, 'de', '16x9'), {}, 'logo.png')
    expect(de.filter((r) => r.status === 'warn').map((r) => r.checkId)).toEqual([
      'prohibited-words',
    ])
    expect(stateOf(de, 'prohibited-words')?.findings[0]?.message).toContain('billig')
  })

  it('skips the logo check with no logo, and names a hidden logo by its file name', () => {
    const plan = planOf('summer-splash')
    const list = planVariants(plan, masterLayers(plan), PICTURE)
    const results = adChecks(plan, find(list, 'en', '1x1'), {}, null)
    expect(stateOf(results, 'required-assets')?.status).toBe('skipped')
    const variant = find(planVariants(plan, masterLayers(plan, BRAND), PICTURE), 'en', '1x1')
    const hidden = {
      ...variant,
      layers: variant.layers.map((l) => (l.key === 'logo' ? { ...l, visible: false } : l)),
    }
    const flagged = adChecks(plan, hidden, {}, 'logo.png')
    expect(stateOf(flagged, 'required-assets')?.findings[0]?.message).toContain('logo.png')
  })

  it('flags a text that does not fit, as measured', () => {
    const plan = planOf('summer-splash')
    const list = planVariants(plan, masterLayers(plan, BRAND), PICTURE)
    const results = adChecks(plan, find(list, 'en', '1x1'), { headline: true }, 'logo.png')
    expect(stateOf(results, 'text-overflow')?.status).toBe('warn')
  })

  it('flags a translation made by AI as not yet approved', () => {
    const plan = planOf('simple-routine')
    let list = planVariants(plan, masterLayers(plan), PICTURE)
    const items = missingItems(list, 'es').map((item) => ({ ...item, text: `es ${item.text}` }))
    list = list.map((v) => withTranslations(v, 'es', items))
    const es = adChecks(plan, find(list, 'es', '1x1'), {}, null)
    expect(stateOf(es, 'unapproved-translations')?.status).toBe('warn')
    const fr = adChecks(plan, find(list, 'fr', '1x1'), {}, null)
    expect(fr.filter((r) => r.status === 'warn')).toEqual([])
  })
})
