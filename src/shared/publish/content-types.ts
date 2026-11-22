// The Content-Type of each uploaded file (spec/phases/phase-09.md "Uploads"), by the lower-case
// extension of its path. Only these are published; anything else has no type.
const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['mp4', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['webm', 'video/webm'],
  ['ttf', 'font/ttf'],
  ['otf', 'font/otf'],
  ['woff2', 'font/woff2'],
  ['html', 'text/html; charset=utf-8'],
  ['json', 'application/json'],
  ['csv', 'text/csv; charset=utf-8'],
])

// `path` is a path, a file name or a bare extension: the text after the last dot counts.
export function contentTypeFor(path: string): string | null {
  return CONTENT_TYPES.get(path.slice(path.lastIndexOf('.') + 1)) ?? null
}
