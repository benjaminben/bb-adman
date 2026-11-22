// spec/providers-adapters.md "Layout and text": LayoutProvider.propose. The instruction, then
// the background as one inline part; the answer is { boxes: LayoutBox[] }, returned as parsed.
// The job clamps the boxes (spec/ai-jobs.md "Layout proposal"). Text is always drawn by the
// app, never by the provider [REQ: FR-061].
import { Type, type Schema } from '@google/genai'
import { z } from 'zod'
import type { AdapterContext, LayoutBox, LayoutProvider } from '@/main/providers/types'
import { TYPE_STYLE_IDS } from '@/shared/config/type-styles'
import type { Transport } from './image'
import { jsonCall } from './json-call'
import { layoutInstruction } from './prompts'

const LayoutAnswer = z.object({
  boxes: z.array(
    z.object({
      slot: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      fontSize: z.number(),
      // Any text: the job turns a colour that is not #RRGGBB into null (layout-clamp).
      color: z.string(),
      align: z.enum(['left', 'center', 'right']),
      // R2E-3: any text, for the job to clamp; a value that is not text is dropped, not failed.
      typeStyle: z.string().optional().catch(undefined),
    }),
  ),
})

const BOX_FIELDS = ['slot', 'x', 'y', 'width', 'height', 'fontSize', 'color', 'align']

const LAYOUT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    boxes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slot: { type: Type.STRING },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          fontSize: { type: Type.NUMBER },
          color: { type: Type.STRING },
          align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
          typeStyle: { type: Type.STRING, enum: TYPE_STYLE_IDS },
        },
        required: BOX_FIELDS,
        propertyOrdering: [...BOX_FIELDS, 'typeStyle'],
      },
    },
  },
  required: ['boxes'],
}

// A box without a typeStyle has no such key, so an answer from before reads as it did.
function readBoxes(value: unknown): LayoutBox[] | null {
  const answer = LayoutAnswer.safeParse(value)
  if (!answer.success) return null
  return answer.data.boxes.map(({ typeStyle, ...rest }) =>
    typeStyle === undefined ? rest : { ...rest, typeStyle },
  )
}

export function geminiLayout(ctx: AdapterContext, transport: Transport = {}): LayoutProvider {
  return {
    propose: (input, opts) => {
      const { background, ...rest } = input
      const picture = Buffer.from(background.bytes).toString('base64')
      const parts = [
        { text: layoutInstruction(rest) },
        { inlineData: { mimeType: background.mime, data: picture } },
      ]
      return jsonCall(
        ctx,
        transport,
        { job: 'layout', parts, responseSchema: LAYOUT_SCHEMA, read: readBoxes },
        opts,
      )
    },
  }
}
