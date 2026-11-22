// The frame plan of a video ad (spec/export-and-checks.md "Video variant", step 1) [REQ: FR-131].
// Time comes from the frame number, never from a clock, so every machine makes the same frames.

// ceil(durationMs / 1000 × fps); the product is taken first so whole numbers stay exact.
export function frameCount(durationMs: number, fps: number): number {
  return Math.ceil((durationMs * fps) / 1000)
}

// Frame i is drawn at i × 1000 / fps milliseconds.
export function frameTimeMs(i: number, fps: number): number {
  return (i * 1000) / fps
}
