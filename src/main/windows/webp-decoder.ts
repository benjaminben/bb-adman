// Slice WP: CoreDeps.webpToPng. One hidden decoder window does the work (webp-window.ts);
// this file keeps the rules around it, with no Electron, so it can be tested alone:
// one conversion at a time, a 10 s limit, and a window that crashed, hung or answered
// wrongly is ended and made again on the next conversion.
export type DecoderPage = {
  // Decodes the WebP given as base64; resolves to the page's answer, which is not trusted.
  decode(base64: string): Promise<unknown>
  end(): void
}

export const DECODE_LIMIT_MS = 10_000

const FAILED = 'The WebP could not be decoded'

export function createWebpDecoder(open: () => DecoderPage, limitMs = DECODE_LIMIT_MS) {
  let page: DecoderPage | null = null
  let queue: Promise<unknown> = Promise.resolve()

  function end(): void {
    page?.end()
    page = null
  }

  async function once(bytes: Uint8Array): Promise<Uint8Array> {
    page ??= open()
    const current = page
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(FAILED)), limitMs)
    })
    try {
      const answer = await Promise.race([
        current.decode(Buffer.from(bytes).toString('base64')),
        late,
      ])
      if (!(answer instanceof Uint8Array)) throw new Error(FAILED)
      return new Uint8Array(answer)
    } catch {
      if (page === current) end()
      throw new Error(FAILED)
    } finally {
      clearTimeout(timer)
    }
  }

  function convert(bytes: Uint8Array): Promise<Uint8Array> {
    const result = queue.then(() => once(bytes))
    queue = result.catch(() => undefined)
    return result
  }

  return { convert, end }
}
