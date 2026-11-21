import { describe, it, expect, vi } from 'vitest'
import { denyPermissions, permissionAllowed } from '@/main/windows/permissions'

describe('permission requests [spec/security.md, renderer and windows]', () => {
  it.each([
    ['clipboard-sanitized-write', true],
    ['clipboard-read', false],
    ['media', false],
    ['geolocation', false],
    ['notifications', false],
    ['midi', false],
    ['midiSysex', false],
    ['pointerLock', false],
    ['fullscreen', false],
    ['openExternal', false],
    ['display-capture', false],
    ['hid', false],
    ['serial', false],
    ['usb', false],
    ['camera', false],
    ['', false],
  ])('%s allowed: %s', (permission, allowed) => {
    expect(permissionAllowed(permission)).toBe(allowed)
  })

  it('sets both the request handler and the check handler on the session', () => {
    const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
    denyPermissions(session)
    const onRequest = session.setPermissionRequestHandler.mock.calls[0]?.[0]
    const onCheck = session.setPermissionCheckHandler.mock.calls[0]?.[0]
    const answers: boolean[] = []
    onRequest(null, 'media', (granted: boolean) => answers.push(granted))
    onRequest(null, 'clipboard-sanitized-write', (granted: boolean) => answers.push(granted))
    expect(answers).toEqual([false, true])
    expect(onCheck(null, 'geolocation')).toBe(false)
    expect(onCheck(null, 'clipboard-sanitized-write')).toBe(true)
  })
})
