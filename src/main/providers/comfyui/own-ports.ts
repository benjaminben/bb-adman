// The app's own listener ports, which a loopback ComfyUI address may not use (SPEC 6.10.1):
// the current MCP port and the Dropbox sign-in port. Read at the moment of each check.
import { DROPBOX_SIGN_IN_PORT } from '@/main/providers/dropbox/sign-in-port'

export function comfyOwnPorts(mcpPort: number): number[] {
  return [mcpPort, DROPBOX_SIGN_IN_PORT]
}
