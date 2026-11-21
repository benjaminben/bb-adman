// SPEC 6.10.12: the test server's address, from COMFY_BASE_URL only. It goes through
// parseComfyAddress, the same as a typed one. With no address, or a refused one, every case
// skips and one line says why; that line names the variable and never holds its value.
import { parseComfyAddress } from '../../src/shared/comfy/address'
import { DROPBOX_SIGN_IN_PORT } from '../../src/main/providers/dropbox/sign-in-port'

// No MCP server runs in this run; the Dropbox sign-in port is the app's one fixed port.
export const TEST_OWN_PORTS: readonly number[] = [DROPBOX_SIGN_IN_PORT]

export type ComfyTarget = { origin: string } | { skip: string }

export function comfyTarget(env: Record<string, string | undefined>): ComfyTarget {
  const text = env.COMFY_BASE_URL?.trim() ?? ''
  if (text === '') return { skip: 'COMFY_BASE_URL is not set, so no ComfyUI case runs.' }
  const parsed = parseComfyAddress(text, TEST_OWN_PORTS)
  if ('reason' in parsed) {
    return { skip: `COMFY_BASE_URL is refused (${parsed.reason}), so no ComfyUI case runs.` }
  }
  return { origin: parsed.origin }
}
