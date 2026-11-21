// parseApprovalsAddress (spec/approvals.md "Settings", security class): the only reader of an
// approvals service address. Gives the origin to store, or null when the address is refused
// (the one sentence is APPROVALS_ADDRESS_MESSAGE). The key is sent to this origin, so only a
// public https name passes; plain http only as http://127.0.0.1:{port} for the dev tools.
export const MAX_APPROVALS_ADDRESS_CHARS = 255

export type AddressOptions = { allowLocalHttp: boolean }

// The written form before parsing: a scheme, '://', then only host and port characters, then
// at most one '/'. So no user info, path, query, fragment, backslash or white space gets
// through, even where the URL parser would drop it quietly (an empty '?' or '#').
const SHAPE = /^[a-z]+:\/\/[^/?#@\\\s]+\/?$/i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const LOCAL_ORIGIN = /^http:\/\/127\.0\.0\.1:[1-9]\d*$/

function readUrl(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

// A host name with at least one dot, no empty label, not an IP address and not localhost. The
// parser has already turned every number form of an IPv4 address into the dotted one.
function isPublicName(hostname: string): boolean {
  if (hostname.startsWith('[') || IPV4.test(hostname)) return false
  const name = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname
  const labels = name.split('.')
  if (labels.length < 2 || labels.some((l) => l === '')) return false
  return labels[labels.length - 1] !== 'localhost'
}

export function parseApprovalsAddress(text: string, opts: AddressOptions): string | null {
  const trimmed = text.trim()
  if (trimmed.length > MAX_APPROVALS_ADDRESS_CHARS || !SHAPE.test(trimmed)) return null
  const url = readUrl(trimmed)
  if (!url || url.username !== '' || url.password !== '') return null
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '' || url.port === '0') {
    return null
  }
  if (url.protocol === 'https:') return isPublicName(url.hostname) ? url.origin : null
  // Exactly as written: no other spelling of 127.0.0.1 and no default port left out.
  const written = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
  const local = opts.allowLocalHttp && url.protocol === 'http:' && LOCAL_ORIGIN.test(written)
  return local && LOCAL_ORIGIN.test(url.origin) ? url.origin : null
}
