import { afterEach, describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import { comfyContext, fakeTiming } from '../../../../helpers/comfy-run'
import { comfyImage } from '@/main/providers/comfyui/image'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { ProviderFailure } from '@/main/providers/types'

afterEach(() => {
  vi.restoreAllMocks()
})

// A stand-in https.request that fails as Node does when the server's certificate cannot be
// checked. It records what would have been written.
function failedCertificate() {
  const written: unknown[] = []
  vi.spyOn(https, 'request').mockImplementation((() => {
    const req = Object.assign(new EventEmitter(), {
      write: (chunk: unknown) => written.push(chunk),
      end: (chunk?: unknown) => written.push(chunk ?? 'end'),
      destroy: () => undefined,
    })
    const error = Object.assign(new Error('stand-in'), { code: 'CERT_HAS_EXPIRED' })
    process.nextTick(() => req.emit('error', error))
    return req
  }) as unknown as typeof https.request)
  return written
}

describe('a whole picture run over HTTPS with a bad certificate [SPEC 6.10.1, 14 F-17]', () => {
  it('ends with reason certificate, and nothing of the run is sent', async () => {
    const written = failedCertificate()
    const { timing } = fakeTiming()
    const provider = comfyImage(
      comfyContext(() => 'https://comfy.example.lan'),
      { timing, checks: createServerChecks() },
    )
    const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
    const e = await provider.generate(input).catch((error: unknown) => error)
    expect(e).toBeInstanceOf(ProviderFailure)
    expect(e).toMatchObject({ error: { kind: 'other', reason: 'certificate' } })
    expect(https.request).toHaveBeenCalledTimes(1)
    expect(written.filter((w) => w !== 'end')).toEqual([])
  })
})
