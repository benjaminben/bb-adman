// A stand-in for Google's Gemini host for workflow-5-1.spec.ts (P4-20), allowed offline only
// (spec/test-harnesses.md, "Main-process fetch stub"). It replaces `fetch` in the built app's
// main process, so no request leaves the computer and no call is paid; the key is made up.
// Each request off this computer gets the answer set by `answerGemini`: held until released,
// a small grey PNG, or one of five failures the Gemini adapter turns into an error kind
// (src/main/providers/gemini/failure.ts). "timeout" needs the adapter's own two-minute timer,
// so it is not offered here. Requests to 127.0.0.1 pass through. Not a test file itself.
import type { ElectronApplication } from '@playwright/test'

export type GeminiAnswer = 'picture' | 'bad_key' | 'quota' | 'refused' | 'offline' | 'other'
export type GeminiMode = GeminiAnswer | 'hold'

type Stand = {
  __w51Mode?: GeminiMode
  __w51Held?: Array<(answer: GeminiAnswer) => void>
}

export async function installGemini(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ nativeImage }) => {
    const stand = globalThis as unknown as Stand
    stand.__w51Mode = 'picture'
    stand.__w51Held = []
    const grey = Buffer.alloc(64 * 64 * 4, 180)
    const png = nativeImage.createFromBitmap(grey, { width: 64, height: 64 }).toPNG()
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    const error = (code: number, status: string) =>
      json(code, { error: { code, message: 'stand-in answer', status } })
    const candidate = (finishReason: string, parts: unknown[]) =>
      json(200, { candidates: [{ finishReason, content: { parts } }] })
    const answer = (kind: GeminiAnswer): Response => {
      if (kind === 'bad_key') return error(401, 'UNAUTHENTICATED')
      if (kind === 'quota') return error(429, 'RESOURCE_EXHAUSTED')
      if (kind === 'other') return error(500, 'INTERNAL')
      if (kind === 'refused') return candidate('SAFETY', [])
      if (kind === 'offline') throw new TypeError('fetch failed')
      const data = png.toString('base64')
      return candidate('STOP', [{ inlineData: { mimeType: 'image/png', data } }])
    }
    const inner = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const address = typeof input === 'string' ? input : 'url' in input ? input.url : input.href
      if (new URL(address).hostname === '127.0.0.1') return inner(input, init)
      const mode = stand.__w51Mode ?? 'picture'
      if (mode !== 'hold') return answer(mode)
      const kind = await new Promise<GeminiAnswer>((resolve) => stand.__w51Held?.push(resolve))
      return answer(kind)
    }
  })
}

export async function answerGemini(app: ElectronApplication, mode: GeminiMode): Promise<void> {
  await app.evaluate((_electron, next) => {
    ;(globalThis as unknown as Stand).__w51Mode = next
  }, mode)
}

// How many requests are held now.
export async function heldCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(() => (globalThis as unknown as Stand).__w51Held?.length ?? 0)
}

// Answers every held request with `kind`.
export async function releaseHeld(app: ElectronApplication, kind: GeminiAnswer): Promise<void> {
  await app.evaluate((_electron, answer) => {
    const held = (globalThis as unknown as Stand).__w51Held ?? []
    held.splice(0).forEach((resolve) => resolve(answer))
  }, kind)
}
