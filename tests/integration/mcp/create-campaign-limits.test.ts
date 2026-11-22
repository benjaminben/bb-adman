// Review leftovers, "Agent tools": create_campaign caps its sizes and languages lists and the
// length of each language, and a language must have the form export's adPath takes (letters,
// digits and '-'). The tool's input schema refuses such a call with the usual input-validation
// error, and nothing is made.
import { afterEach, describe, expect, it } from 'vitest'
import { createInput } from '../campaigns/campaign-fixture'
import { askSetUp, type AskSetUp } from './ask-fixture'
import {
  MAX_CAMPAIGN_LANGUAGES,
  MAX_CAMPAIGN_SIZES,
  MAX_LANGUAGE_CHARS,
} from '@/shared/config/campaign-limits'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const campaignCount = (s: AskSetUp) =>
  (
    s.core.projects
      .requireOpen(s.projectId)
      .db.prepare('SELECT COUNT(*) AS n FROM campaign')
      .get() as {
      n: number
    }
  ).n

async function call(extra: Record<string, unknown>) {
  x = await askSetUp()
  const s = await x.session()
  const input = createInput()
  const reply = await s.call('create_campaign', {
    project_id: x.projectId,
    brief: input.brief,
    subject_map: input.subjectMap.map((m) => ({ ...m, create: false })),
    template_id: input.templateId,
    ...extra,
  })
  return { s: x, reply }
}

const manySizes = Array.from({ length: MAX_CAMPAIGN_SIZES + 1 }, (_, i) => ({
  label: `${100 + i}x100`,
  width: 100 + i,
  height: 100,
}))
const manyLanguages = Array.from({ length: MAX_CAMPAIGN_LANGUAGES + 1 }, (_, i) => `en-x${i}`)
const longLanguage = `en-${'abcdefgh-'.repeat(4)}x`

describe('create_campaign refuses oversized or badly formed sizes and languages', () => {
  it.each([
    ['too many sizes', { sizes: manySizes }],
    ['too many languages', { languages: manyLanguages }],
    ['an over-long language', { languages: [longLanguage] }],
    ['a language with a slash', { languages: ['en/../x'] }],
  ])('refuses %s with the input-validation error and makes nothing', async (_name, extra) => {
    expect(longLanguage.length).toBeGreaterThan(MAX_LANGUAGE_CHARS)
    const { s, reply } = await call(extra)
    expect(reply.isError).toBe(true)
    expect(reply.content?.[0]?.text).toContain('Input validation error')
    expect(campaignCount(s)).toBe(1)
  })

  it('still takes a list at the cap with a well-formed language', async () => {
    const languages = manyLanguages.slice(0, MAX_CAMPAIGN_LANGUAGES)
    const { reply } = await call({ languages, sizes: manySizes.slice(0, MAX_CAMPAIGN_SIZES) })
    expect(reply.isError).toBeFalsy()
  })
})
