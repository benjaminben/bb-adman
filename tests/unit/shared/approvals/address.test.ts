// AP-5 (spec/approvals.md "Settings", "Named tests"): the approvals service address rule.
import { describe, it, expect } from 'vitest'
import { parseApprovalsAddress } from '@/shared/approvals/address'

const strict = (text: string) => parseApprovalsAddress(text, { allowLocalHttp: false })
const local = (text: string) => parseApprovalsAddress(text, { allowLocalHttp: true })

describe('parseApprovalsAddress: accepted https origins [spec/approvals.md "Settings"]', () => {
  it.each([
    ['https://approvals.example.com', 'https://approvals.example.com'],
    ['https://approvals.example.com/', 'https://approvals.example.com'],
    ['  https://approvals.example.com  ', 'https://approvals.example.com'],
    ['HTTPS://Approvals.Example.COM', 'https://approvals.example.com'],
    ['https://adman.someone.workers.dev', 'https://adman.someone.workers.dev'],
    ['https://approvals.example.com:8443', 'https://approvals.example.com:8443'],
    ['https://approvals.example.com:443/', 'https://approvals.example.com'],
    ['https://bücher.example', 'https://xn--bcher-kva.example'],
  ])('stores %s as the origin %s', (text, origin) => {
    expect(strict(text)).toBe(origin)
    expect(local(text)).toBe(origin)
  })
})

describe('parseApprovalsAddress: refused shapes [spec/approvals.md "Named tests"]', () => {
  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['not an address', 'approvals service'],
    ['no scheme', 'approvals.example.com'],
    ['plain http', 'http://approvals.example.com'],
    ['another scheme', 'ftp://approvals.example.com'],
    ['a scheme-relative address', '//approvals.example.com'],
    ['javascript', 'javascript:alert(1)'],
    ['a path', 'https://approvals.example.com/api'],
    ['two slashes', 'https://approvals.example.com//'],
    ['a query', 'https://approvals.example.com/?a=1'],
    ['an empty query', 'https://approvals.example.com?'],
    ['a fragment', 'https://approvals.example.com#top'],
    ['an empty fragment', 'https://approvals.example.com#'],
    ['a backslash', 'https://approvals.example.com\\'],
    ['a backslash before the host', 'https:\\\\approvals.example.com'],
    ['user info', 'https://user@approvals.example.com'],
    ['user and password', 'https://user:pw@approvals.example.com'],
    ['an @ that hides the host', 'https://approvals.example.com@evil.example'],
    ['a space inside', 'https://approvals .example.com'],
    ['a tab inside', 'https://approvals.\texample.com'],
    ['a line break inside', 'https://approvals.example.com\n/x'],
    ['a single-label host', 'https://approvals'],
    ['a single label with a trailing dot', 'https://approvals.'],
    ['an empty label', 'https://approvals..example.com'],
    ['localhost', 'https://localhost'],
    ['localhost with a port', 'https://localhost:8787'],
    ['localhost with a trailing dot', 'https://localhost.'],
    ['a name under localhost', 'https://approvals.localhost'],
    ['an IPv4 address', 'https://203.0.113.5'],
    ['a loopback IPv4 address', 'https://127.0.0.1:8787'],
    ['a short IPv4 form', 'https://127.1'],
    ['a whole-number IPv4 form', 'https://2130706433'],
    ['a hex IPv4 form', 'https://0x7f.0.0.1'],
    ['a percent-encoded IPv4 address', 'https://127.0.0.%31'],
    ['an IPv6 address', 'https://[::1]'],
    ['a mapped IPv6 address', 'https://[::ffff:127.0.0.1]'],
    ['port 0', 'https://approvals.example.com:0'],
    ['a port too big', 'https://approvals.example.com:70000'],
    ['too long', `https://${'a'.repeat(250)}.com`],
  ])('refuses %s', (_name, text) => {
    expect(strict(text)).toBeNull()
  })
})

describe('parseApprovalsAddress: the local test exception [spec/approvals.md "Settings"]', () => {
  it('accepts http://127.0.0.1:{port} only with allowLocalHttp', () => {
    expect(local('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787')
    expect(local('http://127.0.0.1:8787/')).toBe('http://127.0.0.1:8787')
    expect(strict('http://127.0.0.1:8787')).toBeNull()
  })

  it.each([
    ['no port', 'http://127.0.0.1'],
    ['the default port written out', 'http://127.0.0.1:80'],
    ['port 0', 'http://127.0.0.1:0'],
    ['localhost', 'http://localhost:8787'],
    ['another loopback address', 'http://127.0.0.2:8787'],
    ['a short form of 127.0.0.1', 'http://127.1:8787'],
    ['IPv6 loopback', 'http://[::1]:8787'],
    ['a public name', 'http://approvals.example.com:8787'],
    ['a path', 'http://127.0.0.1:8787/api'],
    ['a query', 'http://127.0.0.1:8787?a'],
    ['user info', 'http://a@127.0.0.1:8787'],
    ['a name ending in the address', 'http://evil.127.0.0.1.example:8787'],
  ])('still refuses %s with allowLocalHttp', (_name, text) => {
    expect(local(text)).toBeNull()
  })
})
