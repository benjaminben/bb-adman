// comfy.setAddress (SPEC 4.2, 6.10.1; FR-250, FR-251, FR-253): the one writer of
// settings.comfyui.baseUrl. Security class. Contacts nothing. Agent policy deny.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { comfySetAddressInput } from '@/shared/schemas/commands/comfy'
import { AppError } from '@/shared/schemas/result'
import { COMFY_ADDRESS_MESSAGES, parseComfyAddress } from '@/shared/comfy/address'
import { comfyOwnPorts } from '@/main/providers/comfyui/own-ports'

export function comfySetAddress(deps: Pick<CoreDeps, 'settings'>) {
  return defineCommand({
    name: 'comfy.setAddress',
    input: comfySetAddressInput,
    changesAppState: true,
    run(_ctx, input) {
      const baseUrl = input.address === null ? null : originOf(input.address, deps)
      deps.settings.setComfyAddress(baseUrl)
      return { data: { baseUrl } }
    },
  })
}

function originOf(address: string, deps: Pick<CoreDeps, 'settings'>): string {
  const result = parseComfyAddress(address, comfyOwnPorts(deps.settings.get().mcp.port))
  if ('origin' in result) return result.origin
  // The typed text goes into no message or detail.
  throw new AppError('INVALID_INPUT', COMFY_ADDRESS_MESSAGES[result.reason], {
    reason: result.reason,
  })
}
