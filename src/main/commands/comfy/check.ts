// comfy.check (SPEC 4.2, 6.10.3; FR-252, FR-263, FR-266): the user's "check the address".
// Security class. Agent policy deny. Reads the saved address at call time, asks the server
// afresh on each press, and writes nothing. The reply holds no address.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { comfyCheckInput, type ComfyCheck } from '../../../shared/schemas/commands/comfy-check'
import { AppError } from '../../../shared/schemas/result'
import { createComfyClient } from '../../providers/comfyui/client'
import { comfyOwnPorts } from '../../providers/comfyui/own-ports'
import { serverChecks, type ServerChecks } from '../../providers/comfyui/needs'
import { NON_DRAFT_WORKFLOWS } from '../../providers/comfyui/workflows'
import type { WorkflowSpec } from '../../providers/comfyui/workflows/types'

// The sentence of SPEC 6.10.9 for "no address saved".
export const COMFY_ADDRESS_NEEDED_MESSAGE = "Enter your ComfyUI server's address to use it."

// [1.45] B-3: the check compares no draft workflow.
export function comfyCheck(
  deps: Pick<CoreDeps, 'settings'>,
  checks: ServerChecks = serverChecks,
  workflows: readonly WorkflowSpec[] = NON_DRAFT_WORKFLOWS,
) {
  return defineCommand({
    name: 'comfy.check',
    input: comfyCheckInput,
    async run(): Promise<{ data: ComfyCheck }> {
      const origin = deps.settings.get().comfyui.baseUrl
      if (origin === null) {
        throw new AppError('RULE_VIOLATION', COMFY_ADDRESS_NEEDED_MESSAGE, {
          reason: 'comfy_address_needed',
        })
      }
      // The app's own ports as they are at each connection (SPEC 6.10.1).
      const ownPorts = () => comfyOwnPorts(deps.settings.get().mcp.port)
      const client = createComfyClient({ origin, ownPorts })
      return { data: await checks.run(origin, client, workflows, { fresh: true }) }
    },
  })
}
