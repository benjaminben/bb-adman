// spec/phases/phase-06.md, design addition 5, "Word matching" (A-153) and "Lists" (A-152).

// Languages written without spaces between words: a plain substring match.
const SPACELESS = new Set(['zh', 'ja', 'ko', 'th', 'lo', 'km', 'my'])
const SYMBOLS_ONLY = /^[\p{P}\p{S}\s]+$/u

// A-152: entries trimmed, blank ones dropped; an absent list is an empty one.
export function cleanList(list: string[] | undefined): string[] {
  return (list ?? []).map((entry) => entry.trim()).filter((entry) => entry !== '')
}

// A language tag the runtime refuses falls back to the default locale rather than throwing.
function lowerCase(value: string, language: string): string {
  try {
    return value.toLocaleLowerCase(language)
  } catch {
    return value.toLowerCase()
  }
}

function segmenter(language: string): Intl.Segmenter {
  try {
    return new Intl.Segmenter(language, { granularity: 'word' })
  } catch {
    return new Intl.Segmenter(undefined, { granularity: 'word' })
  }
}

export function normalise(value: string, language: string): string {
  return lowerCase(value.normalize('NFKC'), language)
}

function isSpaceless(language: string): boolean {
  const [primary = ''] = language.split('-')
  return SPACELESS.has(primary.toLowerCase())
}

function wordBoundaries(value: string, language: string): Set<number> {
  const edges = new Set<number>([0, value.length])
  for (const segment of segmenter(language).segment(value)) {
    edges.add(segment.index)
    edges.add(segment.index + segment.segment.length)
  }
  return edges
}

function onBoundaries(haystack: string, needle: string, language: string): boolean {
  const edges = wordBoundaries(haystack, language)
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    if (edges.has(at) && edges.has(at + needle.length)) return true
  }
  return false
}

// True when `entry` appears in `text` for the given language.
export function matches(text: string, entry: string, language: string): boolean {
  const haystack = normalise(text, language)
  const needle = normalise(entry.trim(), language)
  if (needle === '') return false
  if (SYMBOLS_ONLY.test(needle) || isSpaceless(language)) return haystack.includes(needle)
  return onBoundaries(haystack, needle, language)
}
