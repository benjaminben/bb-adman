// comfy.setAddress (SPEC 4.2, 6.10.1; FR-250, FR-251, FR-253): the one writer of
// settings.comfyui.baseUrl. Security class. Contacts nothing. Agent policy deny.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { comfySetAddressInput } from '../../../shared/schemas/commands/comfy'
import { AppError } from '../../../shared/schemas/result'
import { COMFY_ADDRESS_MESSAGES, parseComfyAddress } from '../../../shared/comfy/address'
import { comfyOwnPorts } from '../../providers/comfyui/own-ports'

export function comfySetAddress(deps: Pick<CoreDeps, 'settings'>) {
  return defineCommand({
    name: 'comfy.setAddress',
    input: comfySetAddressInput,
    changesAppState: true,
    run(_ctx, input) {
      if (input.address === null) {
        deps.settings.setComfyAddress(null)
        return { data: { baseUrl: null } }
      }
      const ownPorts = comfyOwnPorts(deps.settings.get().mcp.port)
      const result = parseComfyAddress(input.address, ownPorts)
      if ('reason' in result) {
        // The typed text goes into no message, detail or log line.
        throw new AppError('INVALID_INPUT', COMFY_ADDRESS_MESSAGES[result.reason], {
          reason: result.reason,
        })
      }
      deps.settings.setComfyAddress(result.origin)
      return { data: { baseUrl: result.origin } }
    },
  })
}
