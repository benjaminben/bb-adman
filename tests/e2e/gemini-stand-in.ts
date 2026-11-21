// A stand-in for Google's Gemini host in the offline spec (SPEC 14 1.56 E2E-R, key dialog and
// Retry rows). The fake provider needs no key and is not paid, so only Gemini opens the key
// dialog and the paid confirm. This replaces `fetch` in the built app's main process, as
// screens.ts replaces the file dialog: the Gemini adapter looks `fetch` up on each request
// (gemini/image.ts `pinnedFetch(transport.fetch ?? fetch)`), so every request it makes is
// answered here with a refusal and none leaves the computer. Requests to 127.0.0.1 (the
// stand-in ComfyUI) pass through. No app code changes. Not a test file itself.
import type { ElectronApplication } from '@playwright/test'

// A made-up key that does not look like a real one (real Gemini keys start with "AIza").
export const MADE_UP_KEY = 'made-up-e2e-key-not-real'

type Held = { __e2eGeminiAsked?: string[] }

export async function standInForGemini(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const held = globalThis as unknown as Held
    const asked: string[] = []
    held.__e2eGeminiAsked = asked
    const inner = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const address = typeof input === 'string' ? input : 'url' in input ? input.url : input.href
      const url = new URL(address)
      if (url.hostname === '127.0.0.1') return inner(input, init)
      asked.push(url.origin)
      const refusal = {
        error: { code: 400, message: 'stand-in refusal', status: 'INVALID_ARGUMENT' },
      }
      return new Response(JSON.stringify(refusal), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
  })
}

// The origins of the requests the stand-in answered, oldest first.
export async function geminiAsked(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => [...((globalThis as unknown as Held).__e2eGeminiAsked ?? [])])
}
