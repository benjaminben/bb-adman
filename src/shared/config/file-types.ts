// SPEC 3.1, 8.3 [REQ: FR-051]: the one owner of the accepted file types. A file is accepted
// when its extension is here and its first bytes match the type (src/main/assets/sniff.ts).
// Every picker takes its list from here (SPEC 4.3).

export type AssetKind = 'image' | 'video' | 'font' | 'text' | 'audio'

export type FileType = {
  // The signature sniff.ts checks the first bytes against.
  id:
    | 'png'
    | 'jpeg'
    | 'webp'
    | 'mp4'
    | 'mov'
    | 'webm'
    | 'ttf'
    | 'otf'
    | 'woff2'
    | 'text'
    | 'mp3'
    | 'wav'
    | 'm4a'
    | 'aac'
  kind: AssetKind
  mime: string
  extensions: string[]
}

export const FILE_TYPES: FileType[] = [
  { id: 'png', kind: 'image', mime: 'image/png', extensions: ['png'] },
  { id: 'jpeg', kind: 'image', mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { id: 'webp', kind: 'image', mime: 'image/webp', extensions: ['webp'] },
  { id: 'mp4', kind: 'video', mime: 'video/mp4', extensions: ['mp4'] },
  { id: 'mov', kind: 'video', mime: 'video/quicktime', extensions: ['mov'] },
  { id: 'webm', kind: 'video', mime: 'video/webm', extensions: ['webm'] },
  { id: 'ttf', kind: 'font', mime: 'font/ttf', extensions: ['ttf'] },
  { id: 'otf', kind: 'font', mime: 'font/otf', extensions: ['otf'] },
  { id: 'woff2', kind: 'font', mime: 'font/woff2', extensions: ['woff2'] },
  { id: 'text', kind: 'text', mime: 'text/plain', extensions: ['txt'] },
  { id: 'text', kind: 'text', mime: 'text/markdown', extensions: ['md'] },
  { id: 'text', kind: 'text', mime: 'application/json', extensions: ['json'] },
  { id: 'text', kind: 'text', mime: 'application/yaml', extensions: ['yaml', 'yml'] },
  { id: 'mp3', kind: 'audio', mime: 'audio/mpeg', extensions: ['mp3'] },
  { id: 'wav', kind: 'audio', mime: 'audio/wav', extensions: ['wav'] },
  { id: 'm4a', kind: 'audio', mime: 'audio/mp4', extensions: ['m4a'] },
  { id: 'aac', kind: 'audio', mime: 'audio/aac', extensions: ['aac'] },
]

// The lower-case extension after the last dot, or '' when there is none. A name that is
// only a dot and an extension (".png") has no extension.
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

export function fileTypeFor(fileName: string): FileType | undefined {
  const ext = extensionOf(fileName)
  return FILE_TYPES.find((t) => t.extensions.includes(ext))
}

export type PickPurpose = 'import' | 'relink' | 'brief'

// SPEC 4.3: the extensions a dialog.pickFiles call offers, by purpose and kind.
export function pickerExtensions(purpose: PickPurpose, kind?: AssetKind): string[] {
  const only = purpose === 'brief' ? 'text' : kind
  return FILE_TYPES.filter((t) => !only || t.kind === only).flatMap((t) => t.extensions)
}
