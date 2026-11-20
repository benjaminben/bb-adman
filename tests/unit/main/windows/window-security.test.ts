import { describe, it, expect } from 'vitest'
import { appWindowOptions } from '../../../../src/main/windows/app-window-options'
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

  it('relaxes only script-src and connect-src for the development server', () => {
    const dev = devContentSecurityPolicy('http://localhost:5173')
    expect(dev).toContain("script-src 'self' 'unsafe-inline'")
    expect(dev).toContain('connect-src http://localhost:5173 ws://localhost:5173')
    expect(dev).toContain("default-src 'self'")
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
