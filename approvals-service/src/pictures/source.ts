import 'server-only'
// spec/approvals-service-visitor.md "Pictures": the one interface the picture route uses. The
// service never stores picture bytes; a source fetches them each time.

export type PictureType = 'image/png' | 'image/jpeg'

export type Picture = { bytes: Uint8Array; type: PictureType }

export interface PictureSource {
  // Null for every failure, whatever its cause.
  get(ref: { url: string }): Promise<Picture | null>
}
