// One running encoder (spec/phases/phase-08.md "Video"). A type only: P8-16 spawns FFmpeg and
// gives this shape; the frame pipe writes PNG frames to stdin.
import type { Writable } from 'node:stream'

export type EncoderProcess = {
  // The frame stream, read by the encoder as pipe:0.
  stdin: Writable
  // Settles when the process ends: resolves on a clean exit, rejects otherwise.
  done: Promise<void>
  // Stops the process at once.
  kill(): void
}
