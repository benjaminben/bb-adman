import { describe, it, expect } from 'vitest'
import { hideAddress, makePrinter, safeLine, SAFE_LINE_CHARS } from '../../comfy/print'
import { comfyTarget } from '../../comfy/target'
import { guarded } from '../../comfy/guard'
import { ProviderFailure } from '@/main/providers/types'

const ORIGIN = 'http://marker-host.test:8188'

describe('hideAddress [SPEC 6.10.12]', () => {
  it('replaces the origin, host:port and the host with [test server]', () => {
    const text = `at ${ORIGIN}/prompt, then marker-host.test:8188 and marker-host.test alone`
    expect(hideAddress(text, ORIGIN)).toBe(
      'at [test server]/prompt, then [test server] and [test server] alone',
    )
  })

  it('ignores case, as host names do', () => {
    expect(hideAddress('MARKER-HOST.TEST:8188 down', ORIGIN)).toBe('[test server] down')
  })

  it('hides an IP host and an origin with no port', () => {
    expect(hideAddress('http://10.1.2.3 and 10.1.2.3', 'http://10.1.2.3')).toBe(
      '[test server] and [test server]',
    )
  })

  it('hides an IPv6 host with and without its brackets', () => {
    const origin = 'http://[fd00::5]:8188'
    expect(hideAddress('[fd00::5]:8188 [fd00::5] fd00::5', origin)).toBe(
      '[test server] [test server] [test server]',
    )
  })

  it('leaves text with no address alone', () => {
    expect(hideAddress('Value not in list', ORIGIN)).toBe('Value not in list')
  })
})

describe('safeLine: what test:comfy prints from the server [SPEC 14 1.41, 1.43 K-2]', () => {
  it('removes control characters', () => {
    expect(safeLine('a\u0000b\nc\u001b[31md\u007f', ORIGIN)).toBe('a b c [31md ')
  })

  it('cuts to 500 characters', () => {
    expect(SAFE_LINE_CHARS).toBe(500)
    expect(safeLine('x'.repeat(900), ORIGIN)).toHaveLength(500)
  })

  it('hides the address before cutting, so a cut never leaves part of it', () => {
    const text = `${'x'.repeat(480)}${ORIGIN}`
    const line = safeLine(text, ORIGIN)
    expect(line).not.toContain('marker-host')
    expect(line).toBe(`${'x'.repeat(480)}[test server]`)
  })

  it('hides an address split by a control character', () => {
    expect(safeLine('marker-host.test:81\u000088', ORIGIN)).not.toContain('marker-host')
  })
})

describe('makePrinter [SPEC 6.10.12]', () => {
  it('writes each line through safeLine', () => {
    const written: string[] = []
    const print = makePrinter(ORIGIN, (line) => written.push(line))
    print(`one ${ORIGIN}`, 'two\nlines')
    expect(written).toEqual(['one [test server]', 'two lines'])
  })
})

describe('guarded: no error Vitest prints holds the address [SPEC 6.10.12]', () => {
  it('passes a result through', async () => {
    expect(await guarded(ORIGIN, async () => 7)).toBe(7)
  })

  it('throws a new error with the safe text only, no cause and no fields', async () => {
    const inner = Object.assign(new Error(`refused at ${ORIGIN}`), { origin: ORIGIN })
    const thrown = await guarded(ORIGIN, () => Promise.reject(inner)).catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(Error)
    const error = thrown as Error
    expect(error.message).toBe('refused at [test server]')
    expect(error.cause).toBeUndefined()
    expect(JSON.stringify(Object.entries(error))).not.toContain('marker-host')
    expect(error.stack ?? '').not.toContain('marker-host')
  })

  it('names a provider failure by its kind, reason and detail', async () => {
    const failure = new ProviderFailure({ kind: 'offline', reason: 'no_answer', detail: 'x' })
    const thrown = await guarded(ORIGIN, () => Promise.reject(failure)).catch((e: unknown) => e)
    expect((thrown as Error).message).toBe(
      'ProviderFailure kind: offline, reason: no_answer, detail: x',
    )
  })
})

describe('comfyTarget: the address from COMFY_BASE_URL [SPEC 6.10.12]', () => {
  it('says in one line that COMFY_BASE_URL is not set, naming only the variable', () => {
    expect(comfyTarget({})).toEqual({
      skip: 'COMFY_BASE_URL is not set, so no ComfyUI case runs.',
    })
    expect(comfyTarget({ COMFY_BASE_URL: '  ' })).toEqual(comfyTarget({}))
  })

  it('passes the address through parseComfyAddress, as a typed one', () => {
    expect(comfyTarget({ COMFY_BASE_URL: 'marker-host.test:8188' })).toEqual({
      origin: 'http://marker-host.test:8188',
    })
  })

  it('a refused address is a skip that prints the reason code only', () => {
    const target = comfyTarget({ COMFY_BASE_URL: 'ftp://marker-host.test/' })
    expect(target).toEqual({
      skip: 'COMFY_BASE_URL is refused (address_scheme), so no ComfyUI case runs.',
    })
  })
})
