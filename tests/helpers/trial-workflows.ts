// [D-103] The shipped workflows that ran are `proven`, so the shipped list no longer holds a
// trial. A test file that proves the trial rule (a trial only with the hand-test tools, for
// the user and an agent alike) mocks the list with this copy, where each proven workflow is a
// trial again and each draft stays a draft:
//
//   vi.mock('@/main/providers/comfyui/workflows', async (load) =>
//     (await import('../../helpers/trial-workflows')).asTrial(await load()))
import type * as Shipped from '@/main/providers/comfyui/workflows'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'

type ShippedModule = typeof Shipped

// Copies the property descriptors, so a getter another mock put on a workflow still works.
function trialCopy(w: WorkflowSpec): WorkflowSpec {
  const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(w)) as WorkflowSpec
  return Object.defineProperty(copy, 'status', { value: 'trial', enumerable: true })
}

export function asTrial(real: ShippedModule): ShippedModule {
  const WORKFLOWS = real.WORKFLOWS.map((w) => (w.status === 'proven' ? trialCopy(w) : w))
  return { ...real, WORKFLOWS, NON_DRAFT_WORKFLOWS: real.withoutDrafts(WORKFLOWS) }
}
