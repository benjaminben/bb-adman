import { describe, it, expect } from 'vitest'
import { isRefusedHost } from '../../../../src/shared/comfy/refused-hosts'

const OWN = [47821, 47822]

describe('isRefusedHost on the forms a resolver gives [SPEC 6.10.1, 6.10.2]', () => {
  it.each([
    ['::ffff:169.254.169.254', 8188],
    ['0:0:0:0:0:ffff:169.254.169.254', 8188],
    ['::ffff:127.0.0.1', 47821],
    ['fe80::1', 8188],
    ['fe80::1%en0', 8188],
    ['[fe80::1%25en0]', 8188],
    ['FD00:EC2::254', 80],
    ['0:0:0:0:0:0:0:0', 8188],
    ['0:0:0:0:0:0:0:1', 47822],
  ])('refuses %s on port %i', (host, port) => {
    expect(isRefusedHost(host, port, OWN)).toBe(true)
  })

  it.each([
    ['::ffff:192.168.1.20', 8188],
    ['::ffff:127.0.0.1', 8188],
    ['2001:db8::1', 8188],
    ['::1', 8188],
    ['192.168.1.20', 47821],
  ])('allows %s on port %i', (host, port) => {
    expect(isRefusedHost(host, port, OWN)).toBe(false)
  })

  it('treats text that is not an address as a name', () => {
    expect(isRefusedHost('1:2:3:4:5:6:7:8:9', 8188, OWN)).toBe(false)
    expect(isRefusedHost('1::2::3', 8188, OWN)).toBe(false)
    expect(isRefusedHost('300.1.1.1', 8188, OWN)).toBe(false)
  })
})
