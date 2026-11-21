import { describe, it, expect } from 'vitest'
import { parseComfyAddress } from '../../../../src/shared/comfy/address'

const OWN = [47821, 47822]
const parse = (text: string, ownPorts: number[] = OWN) => parseComfyAddress(text, ownPorts)

describe('parseComfyAddress: accepted forms [SPEC 6.10.1, FR-251, FR-276]', () => {
  it.each([
    ['http://127.0.0.1:8188', 'http://127.0.0.1:8188'],
    ['http://localhost:8188/', 'http://localhost:8188'],
    ['http://[::1]:8188', 'http://[::1]:8188'],
    ['http://192.168.1.20:8188', 'http://192.168.1.20:8188'],
    ['http://my-pc.local:8188', 'http://my-pc.local:8188'],
    ['https://comfy.example.lan', 'https://comfy.example.lan'],
    ['192.168.1.20:8188', 'http://192.168.1.20:8188'],
    ['my-pc:8188', 'http://my-pc:8188'],
    ['  HTTP://My-PC.Local:8188  ', 'http://my-pc.local:8188'],
    ['HTTPS://Comfy.Example.Lan:443/', 'https://comfy.example.lan'],
  ])('accepts %s as the origin %s', (text, origin) => {
    expect(parse(text)).toEqual({ origin })
  })

  it.each([
    'http://10.0.0.5:8188',
    'http://172.16.0.1:8188',
    'http://[fc00::1]:8188',
    'http://[fd12::1]:8188',
    'http://127.0.0.1:9000',
    'http://127.8.9.10:8188',
    'http://localhost',
    'http://comfy.localhost:8188',
    'http://foo.internal:8188',
    'http://[fec0::1]:8188',
  ])('allows the private or loopback address %s', (text) => {
    expect(parse(text)).toHaveProperty('origin')
  })

  it('accepts 255 characters and refuses 256', () => {
    const at255 = `http://${'a'.repeat(248)}`
    expect(at255).toHaveLength(255)
    expect(parse(at255)).toEqual({ origin: at255 })
    expect(parse(`${at255}a`)).toEqual({ reason: 'address_unreadable' })
  })
})

describe('parseComfyAddress: each refusal [SPEC 6.10.1 steps 1 to 6]', () => {
  it.each([
    ['', 'address_empty'],
    ['   ', 'address_empty'],
    ['ftp://192.168.1.20:8188', 'address_scheme'],
    ['file:///etc/hosts', 'address_scheme'],
    ['ws://192.168.1.20:8188', 'address_scheme'],
    ['http://', 'address_unreadable'],
    ['http://exa mple:8188', 'address_unreadable'],
    ['http://host:99999', 'address_unreadable'],
    ['http://host:0', 'address_unreadable'],
    ['host:0', 'address_unreadable'],
    ['http://user:pw@192.168.1.20:8188', 'address_credentials'],
    ['http://user@192.168.1.20:8188', 'address_credentials'],
    ['http://:pw@192.168.1.20:8188', 'address_credentials'],
    ['http://192.168.1.20:8188/comfy', 'address_extra'],
    ['http://192.168.1.20:8188/?x=1', 'address_extra'],
    ['http://192.168.1.20:8188#top', 'address_extra'],
  ])('refuses %j with %s', (text, reason) => {
    expect(parse(text)).toEqual({ reason })
  })
})

describe('parseComfyAddress: refused hosts [SPEC 6.10.1 step 7]', () => {
  it.each([
    'http://169.254.169.254',
    'http://169.254.0.1:8188',
    'http://[fe80::1]:8188',
    'http://[febf::1]:8188',
    'http://[fd00:ec2::254]',
    'http://0.0.0.0:8188',
    'http://[::]:8188',
    'http://224.0.0.1:8188',
    'http://239.255.255.255:8188',
    'http://[ff02::1]:8188',
    'http://255.255.255.255:8188',
    'http://metadata',
    'http://metadata.google.internal',
    'http://METADATA.Google.Internal.',
    'http://instance-data:8188',
    'http://metadata.foo.internal',
  ])('refuses %s', (text) => {
    expect(parse(text)).toEqual({ reason: 'address_host_refused' })
  })

  it.each([
    'http://2852039166',
    'http://0xa9fea9fe',
    'http://0251.0376.0251.0376',
    'http://169.254.43518',
    'http://0',
  ])('refuses the number form %s after it is read as dotted form', (text) => {
    expect(parse(text)).toEqual({ reason: 'address_host_refused' })
  })

  it('reads a number form that is allowed as its dotted origin', () => {
    expect(parse('http://2130706433:8188')).toEqual({ origin: 'http://127.0.0.1:8188' })
    expect(parse('http://0x7f.1:8188')).toEqual({ origin: 'http://127.0.0.1:8188' })
  })

  it.each([
    'http://[::ffff:169.254.169.254]',
    'http://[::ffff:a9fe:a9fe]:8188',
    'http://[::ffff:0.0.0.0]:8188',
    'http://[::ffff:224.0.0.1]:8188',
    'http://[::ffff:127.0.0.1]:47821',
  ])('unwraps the IPv4 address inside %s and refuses it', (text) => {
    expect(parse(text)).toEqual({ reason: 'address_host_refused' })
  })

  it('accepts an allowed IPv4 address inside IPv6', () => {
    expect(parse('http://[::ffff:192.168.1.20]:8188')).toEqual({
      origin: 'http://[::ffff:c0a8:114]:8188',
    })
  })
})

describe("parseComfyAddress: the app's own ports [SPEC 6.10.1]", () => {
  it.each([
    'http://127.0.0.1:47821',
    'http://127.5.5.5:47822',
    'http://[::1]:47821',
    'http://localhost:47822',
    'http://app.localhost:47821',
    'localhost:47821',
    'http://2130706433:47822',
    'http://0x7f.1:47821',
  ])('refuses the loopback address %s on an own port', (text) => {
    expect(parse(text)).toEqual({ reason: 'address_host_refused' })
  })

  it('uses the ports handed in, not fixed ones', () => {
    expect(parse('http://127.0.0.1:47821', [50000])).toEqual({ origin: 'http://127.0.0.1:47821' })
    expect(parse('http://127.0.0.1:50000', [50000])).toEqual({ reason: 'address_host_refused' })
  })

  it('counts the default port of the scheme', () => {
    expect(parse('http://localhost', [80])).toEqual({ reason: 'address_host_refused' })
    expect(parse('https://localhost', [443])).toEqual({ reason: 'address_host_refused' })
  })

  it('allows an own port on another computer', () => {
    expect(parse('http://192.168.1.20:47821')).toEqual({ origin: 'http://192.168.1.20:47821' })
  })
})
