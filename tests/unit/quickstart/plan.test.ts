import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { copySlots, readPlan } from '../../../quickstart/plan'

const BRIEF = `
campaignName: Garden Party
region: France
audience: People who like gardens
message: Grow something
callToAction: Start today
subjects:
  - name: Watering can
    description: A green can
    pictures: can.png
  - name: Trowel
    pictures: [trowel-1.png, trowel-2.png]
languages: [fr, en, de, fr]
sizes: ['1:1', '4:5', '1080x1080']
copy:
  en:
    headline: Grow something
    callToAction: Start today
  de:
    headline: Lass etwas wachsen
`

function planOf(text: string, syntax: 'yaml' | 'json' = 'yaml') {
  const result = readPlan(text, syntax)
  if (!result.ok) throw new Error(result.message)
  return result.plan
}

describe('quickstart readPlan', () => {
  it('lists each language and size once, the first language and size first', () => {
    const plan = planOf(BRIEF)
    expect(plan.languages).toEqual(['fr', 'en', 'de'])
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1', '4x5'])
  })

  it("gives each subject's photo names, and no photo path in the brief itself", () => {
    const plan = planOf(BRIEF)
    expect(plan.subjects).toEqual([
      { name: 'Watering can', description: 'A green can', pictures: ['can.png'] },
      { name: 'Trowel', description: null, pictures: ['trowel-1.png', 'trowel-2.png'] },
    ])
    expect(JSON.stringify(plan.brief)).not.toContain('.png')
  })

  it('translates only a language the brief gives no full copy for', () => {
    expect(planOf(BRIEF).translate).toEqual(['de'])
  })

  it('extends the picture only to a size of other pixels than the first', () => {
    expect(planOf(BRIEF).fills.map((s) => s.label)).toEqual(['4x5'])
  })

  it('falls back to one 1x1 size and the language of the region', () => {
    const plan = planOf(
      'campaignName: A\nregion: Germany\naudience: B\nmessage: C\nsubjects:\n  - name: D\n',
    )
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1'])
    expect(plan.languages).toEqual(['de'])
    expect(plan.translate).toEqual([])
    expect(plan.fills).toEqual([])
  })

  it('reads a JSON brief', () => {
    const json = JSON.stringify({
      campaignName: 'A',
      region: 'US',
      audience: 'B',
      message: 'C',
      subjects: [{ name: 'D' }],
      languages: ['en'],
    })
    expect(planOf(json, 'json').brief.campaignName).toBe('A')
  })

  it('refuses a brief with a missing field, a bad size or broken text', () => {
    const missing = readPlan('campaignName: A\nregion: US\n', 'yaml')
    expect(missing.ok).toBe(false)
    expect(!missing.ok && missing.message).toContain('campaignName, region, audience, message')
    const badSize = readPlan(`${BRIEF}`.replace("'4:5'", "'wide'"), 'yaml')
    expect(!badSize.ok && badSize.message).toContain('"wide"')
    expect(readPlan('{ not yaml', 'yaml').ok).toBe(false)
  })

  it('counts the call to action as a copy slot only when the brief has one', () => {
    expect(copySlots(planOf(BRIEF).brief)).toEqual(['headline', 'call-to-action'])
    const none = planOf(BRIEF.replace('callToAction: Start today\nsubjects', 'subjects'))
    expect(copySlots(none.brief)).toEqual(['headline'])
  })

  it('reads the brief the quickstart ships with', () => {
    const text = readFileSync(
      new URL('../../../quickstart/examples/simple-routine/brief.yaml', import.meta.url),
      'utf8',
    )
    const plan = planOf(text)
    expect(plan.languages).toEqual(['en', 'fr', 'es'])
    expect(plan.sizes.map((s) => s.label)).toEqual(['1x1', '4x5', '9x16'])
    expect(plan.subjects.map((s) => s.pictures)).toEqual([['subject-a.png'], ['subject-b.png']])
    expect(plan.translate).toEqual(['es'])
  })

  it("gives the brief's look: colours, layout, art direction and its notes", () => {
    const text = `${BRIEF}
brand:
  colours: ['#0b3', 'red', '#FFF6E5']
layout: Flat-Bottom-Left
artDirection: '  Calm light  '
`
    const { look, layout } = planOf(text)
    expect(look.colours).toEqual(['#00BB33', '#FFF6E5'])
    expect(look.layoutId).toBe('flat-bottom-left')
    expect(look.artDirection).toBe('Calm light')
    expect(look.notes).toEqual([{ field: 'colours', text: 'red', reason: 'not_a_colour' }])
    expect(layout.id).toBe('flat-bottom-left')
  })

  it('uses the default layout when the brief names none or an unknown one', () => {
    expect(planOf(BRIEF).layout.id).toBe('photo-bottom-left')
    const unknown = planOf(`${BRIEF}\nlayout: zigzag\n`)
    expect(unknown.layout.id).toBe('photo-bottom-left')
    expect(unknown.look.notes.map((n) => n.reason)).toEqual(['unknown_layout'])
  })

  it('lists the brand files the brief names, in role order', () => {
    const text = `${BRIEF}
brand:
  fonts:
    body: brand/Body.woff2
  logo: brand/logo.png
`
    expect(planOf(text).brandFiles).toEqual([
      { role: 'logo', text: 'brand/logo.png' },
      { role: 'bodyFont', text: 'brand/Body.woff2' },
    ])
    expect(planOf(BRIEF).brandFiles).toEqual([])
  })

  it('extends the picture to no size when the layout is a flat colour', () => {
    expect(planOf(`${BRIEF}\nlayout: flat-centre-top\n`).fills).toEqual([])
  })

  it('reads the summer-splash example', () => {
    const url = new URL('../../../quickstart/examples/summer-splash/brief.yaml', import.meta.url)
    const plan = planOf(readFileSync(url, 'utf8'))
    expect(plan.languages).toEqual(['en', 'de'])
    expect(plan.layout.id).toBe('photo-bottom-left')
    expect(plan.look.colours).toEqual(['#0B3D2E', '#FFF6E5', '#FFC83D'])
    expect(plan.look.adsPer).toBe('subject')
    expect(plan.brandFiles.map((f) => f.role)).toEqual(['logo', 'headingFont', 'bodyFont'])
    expect(plan.translate).toEqual([])
  })
})
