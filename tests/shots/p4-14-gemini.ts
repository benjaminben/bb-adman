// A stand-in for Google's Gemini host for the P4-14 pictures, as tests/e2e/gemini-stand-in.ts:
// it replaces `fetch` in the built app's main process, so no request leaves the computer. It
// refuses at once, or holds each request until the shots release it with a refusal or a small
// grey PNG, so a row can be shown failed, running or finished. Requests to 127.0.0.1 pass
// through. No app code changes. Not a test file itself.
import type { ElectronApplication } from '@playwright/test'

export type Answer = 'refuse' | 'picture'
type Held = {
  __p414Mode?: 'refuse' | 'hold'
  __p414Pending?: Array<(answer: Answer) => void>
}

export async function installGemini(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ nativeImage }) => {
    const held = globalThis as unknown as Held
    held.__p414Mode = 'refuse'
    held.__p414Pending = []
    const size = 64
    const grey = Buffer.alloc(size * size * 4, 180)
    const png = nativeImage.createFromBitmap(grey, { width: size, height: size }).toPNG()
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    const answer = (kind: Answer) =>
      kind === 'refuse'
        ? json(400, {
            error: { code: 400, message: 'stand-in refusal', status: 'INVALID_ARGUMENT' },
          })
        : json(200, {
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }],
                },
              },
            ],
          })
    const inner = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const address = typeof input === 'string' ? input : 'url' in input ? input.url : input.href
      if (new URL(address).hostname === '127.0.0.1') return inner(input, init)
      if (held.__p414Mode !== 'hold') return answer('refuse')
      const kind = await new Promise<Answer>((resolve) => held.__p414Pending?.push(resolve))
      return answer(kind)
    }
  })
}

export async function holdGemini(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const held = globalThis as unknown as Held
    held.__p414Mode = 'hold'
  })
}

// Answers the oldest `count` held requests; gives how many were waiting before.
export async function releaseGemini(
  app: ElectronApplication,
  count: number,
  kind: Answer,
): Promise<number> {
  return app.evaluate(
    (_electron, { count, kind }) => {
      const pending = (globalThis as unknown as Held).__p414Pending ?? []
      const waiting = pending.length
      pending.splice(0, count).forEach((resolve) => resolve(kind))
      return waiting
    },
    { count, kind },
  )
}
