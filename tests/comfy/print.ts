// SPEC 6.10.12, 14 1.41 and 1.43 K-2: the address is never printed. Everything test:comfy
// prints goes through `safeLine`: control characters out, the address hidden, then cut to 500
// characters. The address is hidden before the cut, so a cut can never leave part of it.
// CU-5b changes this to `cleanServerText` once CU-4 has built that.

export const SAFE_LINE_CHARS = 500
const HIDDEN = '[test server]'

// C0 controls, DEL and C1 controls, each as one space.
function withoutControls(text: string): string {
  return Array.from(text, (ch) => {
    const code = ch.codePointAt(0) ?? 0
    return code < 0x20 || (code >= 0x7f && code <= 0x9f) ? ' ' : ch
  }).join('')
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Each form the address can take in text, longest first, so a longer one is never left in
// part by a shorter one: the origin, host:port, the host, and an IPv6 host without brackets.
function forms(origin: string): string[] {
  const url = new URL(origin)
  const bare = url.hostname.replace(/^\[(.*)\]$/, '$1')
  const all = [url.origin, url.host, url.hostname, bare].filter((f) => f !== '')
  return [...new Set(all)].sort((a, b) => b.length - a.length)
}

export function hideAddress(text: string, origin: string): string {
  const pattern = new RegExp(forms(origin).map(escaped).join('|'), 'gi')
  return text.replace(pattern, HIDDEN)
}

export function safeLine(text: string, origin: string): string {
  return hideAddress(withoutControls(text), origin).slice(0, SAFE_LINE_CHARS)
}

// Prints each line through safeLine, so no case can print the address by mistake.
export function makePrinter(origin: string, write: (line: string) => void = defaultWrite) {
  return (...lines: string[]) => {
    for (const line of lines) write(safeLine(line, origin))
  }
}

export type Print = ReturnType<typeof makePrinter>

function defaultWrite(line: string): void {
  process.stdout.write(`${line}\n`)
}
