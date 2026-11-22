// P8-14 (spec/export-and-checks.md "Video variant", steps 2 and 3): frames are drawn one at a
// time and written in order to the encoder's input. A slow encoder holds the next draw back, a
// frame like the one before is sent again without a draw, and a cancel stops before the next
// draw and kills the encoder.
import { describe, it, expect, vi } from 'vitest'
import { Writable } from 'node:stream'
import { pipeFrames, FramesCancelled } from '@/main/export/video/frame-pipe'

// An encoder input that takes one frame at a time and needs `delayMs` for each.
function slowSink(delayMs: number) {
  const frames: number[][] = []
  const stdin = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      setTimeout(() => {
        frames.push([...chunk])
        done()
      }, delayMs)
    },
  })
  const finished = new Promise<void>((resolve) => stdin.on('finish', resolve))
  return { sink: { stdin, kill: vi.fn() }, frames, finished }
}

const frame = (i: number) => new Uint8Array([i, i + 1])

describe('pipeFrames', () => {
  it('writes every frame in order and ends the input', async () => {
    const { sink, frames, finished } = slowSink(1)
    const draw = vi.fn(async (i: number) => frame(i))
    await pipeFrames({ count: 5, draw, sink, signal: new AbortController().signal })
    await finished
    expect(frames).toEqual([0, 1, 2, 3, 4].map((i) => [...frame(i)]))
    expect(draw.mock.calls.map(([i]) => i)).toEqual([0, 1, 2, 3, 4])
    expect(sink.kill).not.toHaveBeenCalled()
  })

  it('lets no more than one frame wait for a slow encoder', async () => {
    const { sink, frames } = slowSink(10)
    const waiting: number[] = []
    const draw = async (i: number) => {
      waiting.push(i - frames.length)
      return frame(i)
    }
    await pipeFrames({ count: 6, draw, sink, signal: new AbortController().signal })
    expect(Math.max(...waiting)).toBeLessThanOrEqual(1)
  })

  it('sends the earlier bytes again without a draw when the frame is the same', async () => {
    const { sink, frames, finished } = slowSink(1)
    const draw = vi.fn(async (i: number) => frame(i))
    const sameAsPrevious = (i: number) => i === 2 || i === 3
    await pipeFrames({ count: 5, draw, sameAsPrevious, sink, signal: new AbortController().signal })
    await finished
    expect(draw.mock.calls.map(([i]) => i)).toEqual([0, 1, 4])
    expect(frames).toEqual([frame(0), frame(1), frame(1), frame(1), frame(4)].map((f) => [...f]))
  })

  it('draws the first frame even when it is said to be the same', async () => {
    const { sink, frames, finished } = slowSink(1)
    const draw = vi.fn(async (i: number) => frame(i))
    const signal = new AbortController().signal
    await pipeFrames({ count: 2, draw, sameAsPrevious: () => true, sink, signal })
    await finished
    expect(draw.mock.calls.map(([i]) => i)).toEqual([0])
    expect(frames).toEqual([[...frame(0)], [...frame(0)]])
  })

  it('stops before the next draw on cancel and kills the process', async () => {
    const { sink } = slowSink(1)
    const control = new AbortController()
    const draw = vi.fn(async (i: number) => {
      if (i === 2) control.abort()
      return frame(i)
    })
    const run = pipeFrames({ count: 10, draw, sink, signal: control.signal })
    await expect(run).rejects.toBeInstanceOf(FramesCancelled)
    expect(draw.mock.calls.map(([i]) => i)).toEqual([0, 1, 2])
    expect(sink.kill).toHaveBeenCalledOnce()
  })

  it('stops while it waits for a slow encoder on cancel', async () => {
    const { sink } = slowSink(10_000)
    const control = new AbortController()
    const draw = vi.fn(async (i: number) => frame(i))
    const run = pipeFrames({ count: 10, draw, sink, signal: control.signal })
    setTimeout(() => control.abort(), 20)
    await expect(run).rejects.toBeInstanceOf(FramesCancelled)
    expect(draw).toHaveBeenCalledOnce()
    expect(sink.kill).toHaveBeenCalledOnce()
  })

  it('draws nothing when cancelled before it starts', async () => {
    const { sink } = slowSink(1)
    const control = new AbortController()
    control.abort()
    const draw = vi.fn(async (i: number) => frame(i))
    await expect(pipeFrames({ count: 3, draw, sink, signal: control.signal })).rejects.toThrow(
      FramesCancelled,
    )
    expect(draw).not.toHaveBeenCalled()
    expect(sink.kill).toHaveBeenCalledOnce()
  })

  it('kills the process and fails when a draw fails', async () => {
    const { sink } = slowSink(1)
    const draw = vi.fn(async (i: number) => {
      if (i === 1) throw new Error('A picture of a variant could not be drawn.')
      return frame(i)
    })
    const run = pipeFrames({ count: 3, draw, sink, signal: new AbortController().signal })
    await expect(run).rejects.toThrow('could not be drawn')
    expect(sink.kill).toHaveBeenCalledOnce()
  })

  it('fails when the encoder input closes early', async () => {
    const stdin = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, done) {
        done(new Error('write EPIPE'))
      },
    })
    const sink = { stdin, kill: vi.fn() }
    const draw = async (i: number) => frame(i)
    const run = pipeFrames({ count: 3, draw, sink, signal: new AbortController().signal })
    await expect(run).rejects.toThrow()
    expect(sink.kill).toHaveBeenCalledOnce()
  })

  it('fails, and does not hang, when the encoder input breaks during a draw', async () => {
    const { sink } = slowSink(1)
    const draw = vi.fn(async (i: number) => {
      if (i === 1) sink.stdin.destroy(new Error('write EPIPE'))
      await new Promise((resolve) => setTimeout(resolve, 5))
      return frame(i)
    })
    const run = pipeFrames({ count: 3, draw, sink, signal: new AbortController().signal })
    await expect(run).rejects.toThrow()
    expect(draw).toHaveBeenCalledTimes(2)
    expect(sink.kill).toHaveBeenCalledOnce()
  })
})
