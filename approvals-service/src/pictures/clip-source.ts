import 'server-only'
// round-2-approvals-video.md "The clip route (service)": the one interface the clip route uses.
// The service never stores clip bytes; a source fetches each piece when it is asked for.

export type ClipRange = { start: number; end: number; total: number }

export interface ClipSource {
  // The bytes start..end of the clip, or null for every failure, whatever its cause.
  getPiece(ref: { url: string }, range: ClipRange): Promise<Uint8Array | null>
}
