import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWebpDecoder, type DecoderPage } from '@/main/windows/webp-decoder'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

// A stand-in page: each decode waits for the test to answer it.
function pages() {
  const made: Array<DecoderPage & { asked: string[]; ended: boolean }> = []
  const answers: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = []
  const open = vi.fn(() => {
    const page = {
      asked: [] as string[],
      ended: false,
      decode: (base64: string) => {
        page.asked.push(base64)
        return new Promise<unknown>((resolve, reject) => answers.push({ resolve, reject }))
      },
      end: () => {
        page.ended = true
      },
    }
    made.push(page)
    return page
  })
  return { made, answers, open }
}

const flush = () => new Promise((r) => setImmediate(r))

afterEach(() => vi.useRealTimers())

describe('the WebP decoder window queue [Slice WP]', () => {
  it('opens no window until the first conversion, then sends the bytes as base64', async () => {
    const p = pages()
    const decoder = createWebpDecoder(p.open)
    expect(p.open).not.toHaveBeenCalled()
    const done = decoder.convert(new Uint8Array([1, 2, 3]))
    await flush()
    expect(p.made[0]?.asked).toEqual(['AQID'])
    p.answers[0]?.resolve(PNG)
    expect(await done).toEqual(PNG)
  })

  it('runs one conversion at a time and keeps the same window', async () => {
    const p = pages()
    const decoder = createWebpDecoder(p.open)
    const first = decoder.convert(new Uint8Array([1]))
    const second = decoder.convert(new Uint8Array([2]))
    await flush()
    expect(p.answers).toHaveLength(1)
    p.answers[0]?.resolve(PNG)
    await first
    await flush()
    expect(p.answers).toHaveLength(2)
    p.answers[1]?.resolve(PNG)
    await second
    expect(p.open).toHaveBeenCalledTimes(1)
  })

  type Answers = ReturnType<typeof pages>['answers']
  it.each([
    ['the page crashes', (a: Answers) => a[0]?.reject(new Error('gone'))],
    ['the page answers with something that is not bytes', (a: Answers) => a[0]?.resolve('no')],
  ])(
    'fails the conversion and ends the window when %s; the next one opens a new window',
    async (_n, answer) => {
      const p = pages()
      const decoder = createWebpDecoder(p.open)
      const failed = decoder.convert(new Uint8Array([1]))
      await flush()
      answer(p.answers)
      await expect(failed).rejects.toThrow('The WebP could not be decoded')
      expect(p.made[0]?.ended).toBe(true)
      const next = decoder.convert(new Uint8Array([1]))
      await flush()
      p.answers[1]?.resolve(PNG)
      expect(await next).toEqual(PNG)
      expect(p.open).toHaveBeenCalledTimes(2)
    },
  )

  it('fails a conversion after 10 seconds, ends the window, and starts the next one', async () => {
    vi.useFakeTimers()
    const p = pages()
    const decoder = createWebpDecoder(p.open)
    const slow = decoder.convert(new Uint8Array([1]))
    const next = decoder.convert(new Uint8Array([2]))
    const failed = expect(slow).rejects.toThrow('The WebP could not be decoded')
    await vi.advanceTimersByTimeAsync(9_999)
    expect(p.made[0]?.ended).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await failed
    expect(p.made[0]?.ended).toBe(true)
    expect(p.made[1]?.asked).toEqual(['Ag=='])
    p.answers[1]?.resolve(PNG)
    expect(await next).toEqual(PNG)
  })

  it('end closes the open window, and the next conversion opens a new one', async () => {
    const p = pages()
    const decoder = createWebpDecoder(p.open)
    const done = decoder.convert(new Uint8Array([1]))
    await flush()
    p.answers[0]?.resolve(PNG)
    await done
    decoder.end()
    expect(p.made[0]?.ended).toBe(true)
    void decoder.convert(new Uint8Array([1]))
    await flush()
    expect(p.open).toHaveBeenCalledTimes(2)
  })
})
