// F-8 [A-56]: a run takes at most MAX_REFERENCES_PER_RUN reference pictures, each named once.
// The rule is written once, in referenceIds; the table also runs it through every schema that
// takes a list, so none of them can let a longer list through.
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { referenceIds } from '@/shared/schemas/reference-ids'
import {
  generationRunImagesAgentInput,
  generationRunImagesInput,
  generationStartVideoAgentInput,
  generationStartVideoInput,
} from '@/shared/schemas/commands/generation'
import { imageJobRequest } from '@/shared/schemas/jobs/image-generation'
import { videoJobRequest } from '@/shared/schemas/jobs/video-generation'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `A${i + 1}`)
const TOO_MANY = 'A run takes at most 8 reference pictures.'
const TWICE = 'A reference picture is in the list twice.'

const lists: [string, string[], string | null][] = [
  ['none', ids(0), null],
  ['one', ids(1), null],
  ['eight', ids(8), null],
  ['nine', ids(9), TOO_MANY],
  ['the same picture twice', ['A1', 'A2', 'A1'], TWICE],
]

const run = { projectId: 'P1', variantId: 'V1', prompt: 'a red shoe', provider: 'gemini' }
const image = { ...run, slot: 'hero', count: 1 }
const video = { ...run, durationMs: 4000, start: 'none', useReferences: true }
const size = { prompt: 'a red shoe', width: 1080, height: 1080 }

const schemas: [string, ZodType, object][] = [
  ['referenceIds', referenceIds, {}],
  ['generation.runImages', generationRunImagesInput, image],
  ['generate_images tool', generationRunImagesAgentInput, image],
  ['generation.startVideo', generationStartVideoInput, video],
  ['generate_video tool', generationStartVideoAgentInput, video],
  ['image job request', imageJobRequest, { ...size, count: 1 }],
  ['video job request', videoJobRequest, { ...size, durationMs: 4000, start: 'none' }],
]

function check(schema: ZodType, base: object, list: string[]) {
  const value = schema === referenceIds ? list : { ...base, referenceAssetIds: list }
  const parsed = schema.safeParse(value)
  return parsed.success ? null : parsed.error.issues.map((i) => i.message).join(' ')
}

describe('reference picture limit [F-8, A-56]', () => {
  it('is 8', () => {
    expect(MAX_REFERENCES_PER_RUN).toBe(8)
  })

  describe.each(schemas)('%s', (_name, schema, base) => {
    it.each(lists)('%s', (_label, list, refusal) => {
      expect(check(schema, base, list)).toBe(refusal)
    })
  })
})
