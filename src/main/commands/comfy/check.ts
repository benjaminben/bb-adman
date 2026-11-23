// comfy.check (SPEC 4.2, 6.10.3; FR-252, FR-263, FR-266): the user's "check the address".
// Security class. Agent policy deny. Reads the saved address at call time, asks the server
// afresh on each press, and writes nothing. The reply holds no address.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { comfyCheckInput, type ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { AppError } from '@/shared/schemas/result'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { comfyOwnPorts } from '@/main/providers/comfyui/own-ports'
import { serverChecks, type ServerChecks } from '@/main/providers/comfyui/needs'
import {
  checkedWorkflows,
  NO_CUSTOM,
  type CustomWorkflows,
} from '@/main/providers/comfyui/workflows/all'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { reasonMessage } from '@/shared/providers/messages'

// The sentence of SPEC 6.10.9 for "no address saved"; the one copy is in messages.ts.
export const COMFY_ADDRESS_NEEDED_MESSAGE = reasonMessage('address_needed')

// [1.45] B-3: the check compares no draft workflow. D-104: it compares the custom workflows
// too (checkedWorkflows), read at each press; a test may hand in its own list.
export function comfyCheck(
  deps: Pick<CoreDeps, 'settings'> & { comfyWorkflows?: CustomWorkflows },
  checks: ServerChecks = serverChecks,
  workflows?: readonly WorkflowSpec[],
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
      const compared = workflows ?? checkedWorkflows(deps.comfyWorkflows ?? NO_CUSTOM)
      return { data: await checks.run(origin, client, compared, { fresh: true }) }
    },
  })
}
