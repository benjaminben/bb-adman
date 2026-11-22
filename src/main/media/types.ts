// The media tool (spec/phases/phase-07.md, A-177 to A-179): writes the post's details into a
// clip's file. P7-4 builds it over src/main/media/run-ffmpeg.ts; until then core uses
// noMediaTool.
export type MediaTool = {
  // True when a checked FFmpeg is present.
  available(): boolean
  // The clip with the details written in, or null when they could not be written.
  embedDetails(input: {
    bytes: Uint8Array
    details: Record<string, unknown>
  }): Promise<Uint8Array | null>
}
