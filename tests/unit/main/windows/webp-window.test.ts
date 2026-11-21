import { describe, it, expect } from 'vitest'
import { appWindowOptions } from '@/main/windows/app-window-options'
import { decoderMayLoad, webpPageAddress, webpWindowOptions } from '@/main/windows/webp-window'

// Slice WP; spec/security.md "Rules: renderer and windows", window settings.
describe('WebP decoder window settings [Slice WP]', () => {
  const session = { marker: 'decoder session' } as unknown as Electron.Session

  it("keeps the app window's walls, with no preload, its own session and no dev tools", () => {
    const walls = { ...appWindowOptions('/app/preload.cjs').webPreferences }
    delete walls.preload
    const opts = webpWindowOptions(session)
    expect(opts.webPreferences).toEqual({
      ...walls,
      session,
      backgroundThrottling: false,
      devTools: false,
    })
    expect(opts.webPreferences).not.toHaveProperty('preload')
    expect(opts.show).toBe(false)
  })
})

describe('what the decoder session may load [Slice WP]', () => {
  const built = 'file:///app/out/renderer/webp.html'
  const dev = 'http://localhost:5173/webp.html'

  it.each([
    [built, built, true],
    ['file:///app/out/renderer/assets/webp-a1b2.js', built, true],
    ['file:///app/out/main/index.js', built, false],
    ['file:///app/out/renderer/../../secrets.bin', built, false],
    ['file:///Users/someone/photo.webp', built, false],
    ['https://example.com/x.png', built, false],
    ['adman-asset://p/a', built, false],
    ['data:text/plain,hi', built, false],
    ['http://localhost:5173/assets/webp.js', dev, true],
    ['http://localhost:5174/x.js', dev, false],
    ['ws://localhost:5173/', dev, false],
    ['https://example.com/', dev, false],
    ['not a url', built, false],
  ])('%s from %s: %s', (target, page, allowed) => {
    expect(decoderMayLoad(target, page)).toBe(allowed)
  })
})

describe('the decoder page address [Slice WP; SPEC 8.2 development server exception]', () => {
  const builtPage = 'file:///app/out/renderer/webp.html'

  it.each([
    [
      { isPackaged: false, rendererUrl: 'http://localhost:5173' },
      'http://localhost:5173/webp.html',
    ],
    [{ isPackaged: true, rendererUrl: 'http://localhost:5173' }, builtPage],
    [{ isPackaged: false, rendererUrl: 'https://evil.example' }, builtPage],
    [{ isPackaged: false, rendererUrl: undefined }, builtPage],
  ])('%o gives %s', (opts, address) => {
    expect(webpPageAddress({ ...opts, builtPage })).toBe(address)
  })
})
