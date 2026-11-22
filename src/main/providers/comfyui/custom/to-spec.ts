// spec/comfyui-custom.md "The stored shape", in memory (D-104): a stored custom workflow as a
// normal WorkflowSpec, so filling, running and the check need no second path. The job, the
// video start and the slots come from the graph's marks, by the same file checks the add uses.
import { CUSTOM_SIZE_DEFAULTS, CUSTOM_VIDEO_DEFAULT } from '@/shared/comfy/custom-workflow'
import { LEAVES } from '@/main/providers/comfyui/workflows/common'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { checkWorkflowValue } from './check-file'
import type { StoredCustomWorkflow } from './stored'

export function toCustomSpec(stored: StoredCustomWorkflow): WorkflowSpec {
  const check = checkWorkflowValue(stored.graph)
  // The store hands only files that passed the checks; anything else is an app fault.
  if (!check.ok) throw new Error('A stored workflow failed the file checks')
  const { graph, job, videoStart, slots, nodeTypes } = check.data
  const uploads = slots.references !== undefined || slots.firstFrame !== undefined

  const spec: WorkflowSpec = {
    id: stored.id,
    label: stored.name,
    job,
    status: 'custom',
    version: 1,
    model: { label: 'Custom workflow', mainFile: 'custom ComfyUI workflow' },
    needs: {
      minComfyVersion: '0.0.0',
      checkedWith: '',
      models: [],
      nodeClasses: nodeTypes,
      addOns: [],
    },
    // With no size marks no run reads it.
    size: stored.size ?? CUSTOM_SIZE_DEFAULTS[job],
    licence: { name: 'Not known', url: '', commercialNote: null },
    leavesOnServer: [...(uploads ? [LEAVES.uploads] : []), LEAVES.custom, LEAVES.record],
    source: {
      template: stored.addedBy === 'agent' ? 'added by an agent' : 'added by a person',
      exportedFrom: '',
      changes: [],
    },
    graph,
    slots,
  }
  if (videoStart) {
    spec.videoStart = videoStart
    spec.video = stored.video ?? CUSTOM_VIDEO_DEFAULT
  }
  return spec
}
