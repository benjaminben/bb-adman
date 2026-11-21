// spec/security.md, "Rules: renderer and windows": no window is granted a permission
// (camera, microphone, location, notifications or any other), except the clipboard write
// the Connect panel's Copy button needs.
import type { Session } from 'electron'

export function permissionAllowed(permission: string): boolean {
  return permission === 'clipboard-sanitized-write'
}

type PermissionSession = Pick<Session, 'setPermissionRequestHandler' | 'setPermissionCheckHandler'>

// Both handlers: a request asks once, a check answers whether it would be granted.
export function denyPermissions(session: PermissionSession): void {
  session.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(permissionAllowed(permission)),
  )
  session.setPermissionCheckHandler((_contents, permission) => permissionAllowed(permission))
}
