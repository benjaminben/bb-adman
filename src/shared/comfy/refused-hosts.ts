// The refused hosts of SPEC 6.10.1 (security class). Used on the host the user typed
// (parseComfyAddress) and, from CU-2, on each address a name resolves to.

const METADATA_NAMES = new Set(['metadata', 'metadata.google.internal', 'instance-data'])

function ipv4Parts(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null
  const nums = parts.map(Number)
  return nums.every((n) => n <= 255) ? nums : null
}

// Eight 16-bit groups, or null when the text is not an IPv6 address. Takes the form
// the URL parser writes and the form a resolver gives (which may end in dotted IPv4).
function ipv6Groups(host: string): number[] | null {
  if (!host.includes(':')) return null
  let text = host
  const tail: number[] = []
  const lastColon = text.lastIndexOf(':')
  const v4 = ipv4Parts(text.slice(lastColon + 1))
  if (v4) {
    tail.push(((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0))
    text = `${text.slice(0, lastColon + 1)}0`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const read = (s: string) => (s === '' ? [] : s.split(':'))
  const head = read(halves[0] ?? '')
  const rest = halves.length === 2 ? read(halves[1] ?? '') : []
  if (![...head, ...rest].every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null
  const fill = 8 - head.length - rest.length - (tail.length ? 1 : 0)
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill('0'), ...rest]
  const nums = groups.map((g) => parseInt(g, 16))
  if (tail.length) nums.pop()
  return [...nums, ...tail]
}

function refusedIpv4([a, b, c, d]: number[], ownPort: boolean): boolean {
  if (a === 169 && b === 254) return true
  if (a === 0 && b === 0 && c === 0 && d === 0) return true
  if (a !== undefined && a >= 224 && a <= 239) return true
  if (a === 255 && b === 255 && c === 255 && d === 255) return true
  return a === 127 && ownPort
}

function refusedIpv6(g: number[], ownPort: boolean): boolean {
  const first = g[0] ?? 0
  const allZeroBefore = (n: number) => g.slice(0, n).every((x) => x === 0)
  if (allZeroBefore(5) && g[5] === 0xffff) {
    const [hi = 0, lo = 0] = g.slice(6)
    return refusedIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255], ownPort)
  }
  if ((first & 0xffc0) === 0xfe80) return true
  if (first >> 8 === 0xff) return true
  if (g.join(':') === [0xfd00, 0xec2, 0, 0, 0, 0, 0, 0x254].join(':')) return true
  if (allZeroBefore(8)) return true
  return allZeroBefore(7) && g[7] === 1 && ownPort
}

function refusedName(name: string, ownPort: boolean): boolean {
  if (METADATA_NAMES.has(name)) return true
  if (name.startsWith('metadata.') && name.endsWith('.internal')) return true
  return (name === 'localhost' || name.endsWith('.localhost')) && ownPort
}

// host: a name, a dotted IPv4 address, or an IPv6 address with or without brackets.
export function isRefusedHost(host: string, port: number, ownPorts: readonly number[]): boolean {
  const bare = host.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  const ownPort = ownPorts.includes(port)
  const v4 = ipv4Parts(bare)
  if (v4) return refusedIpv4(v4, ownPort)
  // A zone suffix (fe80::1%en0) names a network card, not another machine.
  const v6 = ipv6Groups(bare.replace(/%.*$/, ''))
  if (v6) return refusedIpv6(v6, ownPort)
  return refusedName(bare.replace(/\.$/, ''), ownPort)
}
