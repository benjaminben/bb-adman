// Test helper for the Gemini JSON calls (layout and text): a made-up answer whose first text
// part is given, and a way to catch the ProviderFailure a call throws.
import { expect } from 'vitest'
import { ProviderFailure } from '@/main/providers/types'
import { TEST_MODEL, jsonResponse, recordingFetch } from './recorded'

export function textAnswer(text: string, finishReason = 'STOP') {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }],
    modelVersion: TEST_MODEL,
  }
}

// A fetch that answers every request with `text` as the first text part.
export function answering(text: string) {
  return recordingFetch(async () => jsonResponse(textAnswer(text)))
}

export async function failureOf(run: Promise<unknown>): Promise<ProviderFailure> {
  const error = await run.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderFailure)
  return error as ProviderFailure
}
