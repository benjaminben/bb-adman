import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/fake'
import { ProviderFailure, type AdapterContext, type TextProvider } from '@/main/providers/types'
import type { Brief } from '@/shared/schemas/brief'
import { describeSwitches } from './fake-switches'

const ctx = {} as AdapterContext
const text = (): TextProvider => {
  const build = adapters.text
  if (!build) throw new Error('fake has no text part')
  return build(ctx)
}

const BRIEF_MD = [
  '# Spring brief',
  '',
  'Campaign name: Spring Sale',
  'REGION: UK',
  'audience: Young adults',
  'Message: Light shoes for long walks',
  'Offer: 20% off',
  'Call to action: Shop now',
  'Tone: Warm',
  'Languages: en, fr , de',
  'Sizes: 1080x1080, 1080x1920',
  'Subject: Trail shoe - A light running shoe',
  'Subject: Rain jacket',
  'Budget: 10000',
  'Some free text with no label.',
].join('\n')

const brief: Brief = {
  campaignName: 'Spring Sale',
  region: 'UK',
  audience: 'Young adults',
  message: 'Light shoes',
  subjects: [{ name: 'Trail shoe' }],
}

describe('fake provider, extract brief [spec/ai-jobs.md "The fake provider\'s parts"]', () => {
  it('reads every label in any letter case into the draft, ignoring other lines', async () => {
    expect(await text().extractBrief({ text: BRIEF_MD })).toEqual({
      campaignName: 'Spring Sale',
      region: 'UK',
      audience: 'Young adults',
      message: 'Light shoes for long walks',
      offer: '20% off',
      callToAction: 'Shop now',
      tone: 'Warm',
      languages: ['en', 'fr', 'de'],
      sizes: ['1080x1080', '1080x1920'],
      subjects: [
        { name: 'Trail shoe', description: 'A light running shoe' },
        { name: 'Rain jacket' },
      ],
    })
  })

  it('gives an empty draft for text with no labels', async () => {
    expect(await text().extractBrief({ text: 'Nothing here\nBudget: 5' })).toEqual({})
  })
})

describe('fake provider, copy options', () => {
  it.each([
    ['call_to_action', 3, 40],
    ['text', 8, 120],
    ['text', 2, 10],
  ] as const)('%s: gives %i options within %i characters', async (role, count, maxChars) => {
    const options = await text().copyOptions({ role, brief, language: 'en', count, maxChars })
    expect(options).toHaveLength(count)
    for (const o of options) {
      expect([...o].length).toBeGreaterThan(0)
      expect([...o].length).toBeLessThanOrEqual(maxChars)
    }
  })

  it('starts the call-to-action list with "Shop the collection"', async () => {
    const input = { role: 'call_to_action', brief, language: 'en', count: 2, maxChars: 40 } as const
    expect(await text().copyOptions(input)).toEqual(['Shop the collection', 'Find your fit'])
  })
})

describe('fake provider, translate', () => {
  it('refuses: not built yet', async () => {
    const input = { items: [], from: 'en', to: 'fr', region: 'FR', audience: 'all' }
    const error = await text()
      .translate(input)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ProviderFailure)
    expect((error as ProviderFailure).error).toEqual({
      kind: 'other',
      detail: 'Translate is not built yet',
    })
  })
})

describeSwitches('extract brief', (opts) => text().extractBrief({ text: BRIEF_MD }, opts))
describeSwitches('copy options', (opts) =>
  text().copyOptions({ role: 'text', brief, language: 'en', count: 1, maxChars: 40 }, opts),
)
