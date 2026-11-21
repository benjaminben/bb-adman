// parseComfyAddress (SPEC 6.10.1, security class; FR-251, FR-276): the only reader of a
// ComfyUI address the user typed. Gives the origin to store, or why it is refused.
import { isRefusedHost } from './refused-hosts'

export const MAX_COMFY_ADDRESS_CHARS = 255

export type ComfyAddressReason =
  | 'address_empty'
  | 'address_unreadable'
  | 'address_scheme'
  | 'address_credentials'
  | 'address_extra'
  | 'address_host_refused'

export type ComfyAddressResult = { origin: string } | { reason: ComfyAddressReason }

// One plain sentence per reason (SPEC 4.2 comfy.setAddress). None repeats the typed text.
export const COMFY_ADDRESS_MESSAGES: Record<ComfyAddressReason, string> = {
  address_empty: 'Enter the address of your ComfyUI server.',
  address_unreadable:
    'That address cannot be read. Enter it as it is shown, for example http://127.0.0.1:8188.',
  address_scheme: 'The address must start with http:// or https://.',
  address_credentials: 'The address must not hold a user name or password.',
  address_extra: 'Enter only the server address, with no path after it.',
  address_host_refused: 'That address cannot be used for a ComfyUI server.',
}

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 }

function readUrl(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

export function parseComfyAddress(text: string, ownPorts: readonly number[]): ComfyAddressResult {
  const trimmed = text.trim()
  if (trimmed === '') return { reason: 'address_empty' }
  if (trimmed.length > MAX_COMFY_ADDRESS_CHARS) return { reason: 'address_unreadable' }
  let full = trimmed
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes('://')) return { reason: 'address_scheme' }
    full = `http://${trimmed}`
  }
  const url = readUrl(full)
  if (!url || url.hostname === '') return { reason: 'address_unreadable' }
  if (url.username !== '' || url.password !== '') return { reason: 'address_credentials' }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    return { reason: 'address_extra' }
  }
  if (url.port === '0') return { reason: 'address_unreadable' }
  const port = url.port === '' ? (DEFAULT_PORTS[url.protocol] ?? 0) : Number(url.port)
  if (isRefusedHost(url.hostname, port, ownPorts)) return { reason: 'address_host_refused' }
  return { origin: url.origin }
}
