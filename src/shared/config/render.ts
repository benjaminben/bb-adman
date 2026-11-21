// spec/scene.md, "One draw": the one owner of the render limits. timeMs is the time a draw
// may take; maxDimension the largest side the render window draws; thumbnailSide the longer
// side of a thumbnail.
export const RENDER_LIMITS = { timeMs: 10_000, maxDimension: 2048, thumbnailSide: 512 } as const
