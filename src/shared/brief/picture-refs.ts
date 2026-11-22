// Round 2 plan D3 [A-343]: what one picture text in a brief names. Pure; never throws; reads
// no file. src/shared may not import node:path, so the two rules it needs (isAbsolute and
// normalize, for an absolute path only) are kept here as node:path states them; the tests
// hold them to node:path.

export type PictureRef =
  | { kind: 'asset'; assetId: string }
  | { kind: 'file'; path: string }
  | { kind: 'relative'; text: string }

const ULID = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/
const DRIVE = /^[A-Za-z]:[\\/]/

const isWinSeparator = (char: string | undefined): boolean => char === '\\' || char === '/'

// The segments after the root: empty and "." ones go, ".." drops the one before it and
// stops at the root. A trailing separator is kept when anything is left.
function tail(rest: string, separator: string, split: RegExp): string {
  const kept: string[] = []
  for (const part of rest.split(split)) {
    if (part === '' || part === '.') continue
    if (part === '..') kept.pop()
    else kept.push(part)
  }
  const joined = kept.join(separator)
  return joined !== '' && split.test(rest.slice(-1)) ? joined + separator : joined
}

// node:path win32: `\\server\share` (a UNC root), `C:\` (a drive) or one separator.
function winRoot(text: string): { root: string; rest: string } {
  if (DRIVE.test(text)) return { root: `${text.slice(0, 2)}\\`, rest: text.slice(3) }
  if (!isWinSeparator(text[1])) return { root: '\\', rest: text.slice(1) }
  const unc = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/.exec(text)
  if (unc === null) return { root: '\\', rest: text }
  return { root: `\\\\${unc[1]}\\${unc[2]}\\`, rest: text.slice(unc[0].length) }
}

function absolutePath(text: string, platform: NodeJS.Platform): string | null {
  if (platform === 'win32') {
    if (!DRIVE.test(text) && !isWinSeparator(text[0])) return null
    const { root, rest } = winRoot(text)
    return root + tail(rest, '\\', /[\\/]/)
  }
  if (!text.startsWith('/')) return null
  return `/${tail(text, '/', /\//)}`
}

export function pictureRef(text: string, platform: NodeJS.Platform): PictureRef {
  if (ULID.test(text)) return { kind: 'asset', assetId: text.toUpperCase() }
  const path = absolutePath(text, platform)
  return path === null ? { kind: 'relative', text } : { kind: 'file', path }
}
