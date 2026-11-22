// The frame pipe of a video ad (spec/export-and-checks.md "Video variant", steps 2 and 3). Frames
// are drawn one at a time and written in order to the encoder's input. A frame is drawn only once
// the encoder has taken the one before, so no more than one frame waits. A frame the same as the
// one before is sent again without a draw. A cancel stops before the next draw; a cancel or any
// failure kills the encoder.
import type { EncoderProcess } from './encoder-process'

export class FramesCancelled extends Error {
  constructor() {
    super('The export was cancelled.')
    this.name = 'FramesCancelled'
  }
}

export type FrameSink = Pick<EncoderProcess, 'stdin' | 'kill'>

export type PipeFramesInput = {
  count: number
  draw: (i: number) => Promise<Uint8Array>
  // True when no layer changes between frame i - 1 and frame i. Until P8-17, always false.
  sameAsPrevious?: (i: number) => boolean
  sink: FrameSink
  signal: AbortSignal
}

// Writes one frame; when the input is full, waits until it drains, fails or is cancelled.
function write(sink: FrameSink, bytes: Uint8Array, signal: AbortSignal): Promise<void> {
  const { stdin } = sink
  return new Promise<void>((resolve, reject) => {
    const settle = (error?: Error) => {
      stdin.off('drain', drained)
      stdin.off('error', failed)
      stdin.off('close', closed)
      signal.removeEventListener('abort', aborted)
      if (error) reject(error)
      else resolve()
    }
    const drained = () => settle()
    const failed = (error: Error) => settle(error)
    const closed = () => settle(new Error('The encoder input closed early.'))
    const aborted = () => settle(new FramesCancelled())
    stdin.on('error', failed)
    stdin.on('close', closed)
    signal.addEventListener('abort', aborted)
    if (stdin.write(bytes)) settle()
    else stdin.on('drain', drained)
  })
}

// Fails when the run was cancelled or the encoder input broke since the last write.
function check(sink: FrameSink, signal: AbortSignal): void {
  if (signal.aborted) throw new FramesCancelled()
  if (sink.stdin.destroyed) throw new Error('The encoder input closed early.')
}

async function pipeAll(input: PipeFramesInput): Promise<void> {
  const { count, draw, sink, signal } = input
  const same = input.sameAsPrevious ?? (() => false)
  let previous: Uint8Array | null = null
  for (let i = 0; i < count; i++) {
    check(sink, signal)
    const bytes: Uint8Array = previous && same(i) ? previous : await draw(i)
    check(sink, signal)
    await write(sink, bytes, signal)
    previous = bytes
  }
  sink.stdin.end()
}

export async function pipeFrames(input: PipeFramesInput): Promise<void> {
  // An encoder that dies between writes breaks its input with no write waiting; this listener
  // keeps that error from going unhandled. The next check fails the run.
  const ignore = () => undefined
  input.sink.stdin.on('error', ignore)
  try {
    await pipeAll(input)
  } catch (error) {
    input.sink.kill()
    throw error
  }
}
