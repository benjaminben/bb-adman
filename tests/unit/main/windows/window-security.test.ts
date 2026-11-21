import { describe, it, expect } from 'vitest'
import { appWindowOptions } from '../../../../src/main/windows/app-window-options'
import { pageAddress } from '../../../../src/main/windows/app-window'
import { CONTENT_SECURITY_POLICY, devContentSecurityPolicy } from '../../../../src/main/windows/csp'
import { decideWindowOpen, isAllowedNavigation } from '../../../../src/main/windows/navigation'

describe('app window settings [SPEC 8.2]', () => {
  it('turns on context isolation, sandbox and web security and turns off node integration', () => {
    const opts = appWindowOptions('/app/preload.cjs')
    expect(opts.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: '/app/preload.cjs',
    })
  })
})

describe('content security policy [SPEC 8.2]', () => {
  it('is exactly the policy in Section 8.2', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(
      [
        "default-src 'self'",
        "img-src 'self' adman-asset: data: blob:",
        'media-src adman-asset:',
        "font-src 'self' adman-asset:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "connect-src 'none'",
      ].join('; '),
    )
  })

  it('relaxes only script-src and connect-src for the development server, character for character', () => {
    expect(devContentSecurityPolicy('http://localhost:*')).toBe(
      [
        "default-src 'self'",
        "img-src 'self' adman-asset: data: blob:",
        'media-src adman-asset:',
        "font-src 'self' adman-asset:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        'connect-src http://localhost:* ws://localhost:*',
      ].join('; '),
    )
  })
})

describe('page address [SPEC 8.2 development server exception]', () => {
  const builtPage = 'file:///app/out/renderer/index.html'

  it('loads the development server only when the app is not packaged and the address is http://localhost:{port}', () => {
    expect(
      pageAddress({ isPackaged: false, rendererUrl: 'http://localhost:5173', builtPage }),
    ).toBe('http://localhost:5173')
  })

  it('loads the built page when the app is packaged, even with ELECTRON_RENDERER_URL set', () => {
    expect(pageAddress({ isPackaged: true, rendererUrl: 'http://localhost:5173', builtPage })).toBe(
      builtPage,
    )
  })

  it.each([
    undefined,
    '',
    'https://localhost:5173',
    'http://example.com:5173',
    'http://localhost.example.com:5173',
    'http://127.0.0.1:5173',
    'http://localhost',
    'http://localhost:5173/page',
    'http://user@localhost:5173',
    'file:///tmp/index.html',
  ])('loads the built page when the address is %j', (rendererUrl) => {
    expect(pageAddress({ isPackaged: false, rendererUrl, builtPage })).toBe(builtPage)
  })
})

describe('navigation and new windows [SPEC 8.1]', () => {
  it('never opens a new window, and sends https links to the system browser', () => {
    expect(decideWindowOpen('https://example.com/help')).toEqual({
      action: 'deny',
      openExternal: true,
    })
    expect(decideWindowOpen('http://example.com')).toEqual({ action: 'deny', openExternal: false })
    expect(decideWindowOpen('file:///etc/passwd')).toEqual({ action: 'deny', openExternal: false })
    expect(decideWindowOpen('javascript:alert(1)')).toEqual({ action: 'deny', openExternal: false })
  })

  it('blocks navigation away from the app page', () => {
    const appUrl = 'file:///Applications/Adman.app/Contents/Resources/app/out/renderer/index.html'
    expect(isAllowedNavigation(appUrl, appUrl)).toBe(true)
    expect(isAllowedNavigation('https://evil.example', appUrl)).toBe(false)
    expect(isAllowedNavigation('file:///Users/me/other.html', appUrl)).toBe(false)
  })

  it('allows the development server origin when the app page is served from it', () => {
    expect(isAllowedNavigation('http://localhost:5173/#x', 'http://localhost:5173/')).toBe(true)
    expect(isAllowedNavigation('http://localhost:5174/', 'http://localhost:5173/')).toBe(false)
  })
})

describe('app window size [SPEC 1.3, D-031]', () => {
  it('keeps 1280 x 820 to return to, 900 x 600 as the smallest, and never sets fullscreen', () => {
    const opts = appWindowOptions('/app/preload.cjs')
    expect(opts).toMatchObject({ width: 1280, height: 820, minWidth: 900, minHeight: 600 })
    expect(opts).not.toHaveProperty('fullscreen')
  })
})

describe('page address: one trailing slash [SPEC 8.2, S2-02]', () => {
  const builtPage = 'file:///app/out/renderer/index.html'

  it('accepts the development address with one trailing slash', () => {
    expect(
      pageAddress({ isPackaged: false, rendererUrl: 'http://localhost:5173/', builtPage }),
    ).toBe('http://localhost:5173/')
  })

  it.each(['http://localhost:5173/x', 'http://localhost:5173//', 'http://localhost:5173/?a=1'])(
    'loads the built page when anything follows the slash: %j',
    (rendererUrl) => {
      expect(pageAddress({ isPackaged: false, rendererUrl, builtPage })).toBe(builtPage)
    },
  )
})
