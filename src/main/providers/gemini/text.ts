// spec/providers-adapters.md "Layout and text": TextProvider. Extract brief, copy options and
// translate (spec/phases/phase-06.md section 3) are one JSON call each.
import { Type, type Schema } from '@google/genai'
import { z } from 'zod'
import { briefDraftFrom } from '@/shared/brief/draft'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { AdapterContext, TextProvider } from '@/main/providers/types'
import type { Transport } from './image'
import { jsonCall } from './json-call'
import { BRIEF_INSTRUCTION, BRIEF_LINE, TEXTS_LINE } from './prompts'
import { copyInstruction, translateInstruction } from './prompts'

const text = { type: Type.STRING }
const texts = { type: Type.ARRAY, items: text }

// The BriefDraft fields, every one optional. The word lists are asked as plain lists (one of
// their two allowed forms). `copy` is keyed by language code, which this schema form cannot
// state, so it is not asked for.
const BRIEF_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    campaignName: text,
    region: text,
    audience: text,
    message: text,
    subjects: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { name: text, description: text } },
    },
    offer: text,
    callToAction: text,
    tone: text,
    requiredWords: texts,
    prohibitedWords: texts,
    languages: texts,
    sizes: texts,
  },
}

const COPY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { options: texts },
  required: ['options'],
}

const TRANSLATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { key: text, text },
        required: ['key', 'text'],
      },
    },
  },
  required: ['items'],
}

const CopyAnswer = z.object({ options: z.array(z.string()) })

// Each item leaves as exactly its two strings; any other field is dropped. Which keys were
// asked, repeats and empty texts are the job's to clean (A-168).
const TranslateAnswer = z.object({
  items: z.array(z.object({ key: z.string(), text: z.string() })),
})

function readDraft(value: unknown): BriefDraft | null {
  const draft = briefDraftFrom(value)
  return draft.ok ? draft.data : null
}

function readOptions(value: unknown): string[] | null {
  const answer = CopyAnswer.safeParse(value)
  return answer.success ? answer.data.options : null
}

function readTranslations(value: unknown): Array<{ key: string; text: string }> | null {
  const answer = TranslateAnswer.safeParse(value)
  return answer.success ? answer.data.items.map(({ key, text }) => ({ key, text })) : null
}

export function geminiText(ctx: AdapterContext, transport: Transport = {}): TextProvider {
  return {
    extractBrief: (input, opts) => {
      const parts = [{ text: BRIEF_INSTRUCTION }, { text: `${BRIEF_LINE}\n${input.text}` }]
      const call = { job: 'text' as const, parts, responseSchema: BRIEF_SCHEMA, read: readDraft }
      return jsonCall(ctx, transport, call, opts)
    },
    copyOptions: (input, opts) => {
      const parts = [{ text: copyInstruction(input) }]
      const call = { job: 'text' as const, parts, responseSchema: COPY_SCHEMA, read: readOptions }
      return jsonCall(ctx, transport, call, opts)
    },
    translate: (input, opts) => {
      const items = input.items.map(({ key, text }) => ({ key, text }))
      const parts = [
        { text: translateInstruction(input) },
        { text: `${TEXTS_LINE}\n${JSON.stringify(items)}` },
      ]
      const call = {
        job: 'text' as const,
        parts,
        responseSchema: TRANSLATE_SCHEMA,
        read: readTranslations,
      }
      return jsonCall(ctx, transport, call, opts)
    },
  }
}
