import { describe, it, expect, vi } from 'vitest'
import type { Protocol } from 'electron'
import { registerAssetProtocol, registerAssetScheme } from '@/main/windows/asset-protocol'
import { createProjectRegistry } from '@/main/db/project-registry'

function fakeProtocol() {
  return {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  }
}

describe('the adman-asset scheme [SPEC 14, Slice A rulings point 2, A2-2]', () => {
  it('registers it as standard, secure and stream, with everything else off', () => {
    const protocol = fakeProtocol()
    registerAssetScheme(protocol as unknown as Protocol)
    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: 'adman-asset',
        privileges: {
          standard: true,
          secure: true,
          stream: true,
          bypassCSP: false,
          allowServiceWorkers: false,
          supportFetchAPI: false,
          corsEnabled: false,
          codeCache: false,
          allowExtensions: false,
        },
      },
    ])
  })

  it('handles the scheme with the answer builder over the open projects', async () => {
    const protocol = fakeProtocol()
    registerAssetProtocol(protocol as unknown as Protocol, createProjectRegistry())
    expect(protocol.handle).toHaveBeenCalledWith('adman-asset', expect.any(Function))
    const handler = protocol.handle.mock.calls[0]?.[1] as (r: Request) => Promise<Response>
    const res = await handler(new Request('https://x.invalid/', { method: 'GET' }))
    expect(res.status).toBe(404)
  })
})
