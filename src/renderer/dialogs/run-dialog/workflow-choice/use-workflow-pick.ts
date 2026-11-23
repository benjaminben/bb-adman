// CW-5 (spec/comfyui-custom.md, the workflow picker and the remembered choice): the run
// dialog's workflow state. The workflows that fit the run, the one picked (the person's pick,
// else the remembered one when it still fits, else the default), and whether there are enough
// to choose from. A retry keeps the stored workflow, which the main process reads, so it has
// no kind of run here and fits none.
import { useState } from 'react'
import type { VideoStartKind } from '@/shared/config/video-offers'
import { workflowModel } from '@/shared/providers/model-words'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Settings } from '@/shared/schemas/settings'
import type { Choice } from '@/renderer/dialogs/run-dialog/run-choices'
import type { RunJob } from '@/renderer/dialogs/run-dialog/run-summary'
import { choiceKey, fittingWorkflows, startWorkflow } from './fitting'

type PickFor = {
  job: RunJob
  info: ComfyInfo | null
  referenceCount: number
  start: VideoStartKind | undefined
  retry: { provider: string } | undefined
  remembered: Settings['comfyWorkflowChoice'] | undefined
}

export function useWorkflowPick(given: PickFor) {
  const [picked, setPicked] = useState<string | null>(null)
  const key =
    given.retry !== undefined ? null : choiceKey(given.job, given.referenceCount, given.start)
  const fitting = fittingWorkflows(given.info, key)
  const remembered = key === null ? undefined : given.remembered?.[key]
  const workflow = fitting.find((w) => w.id === picked) ?? startWorkflow(fitting, remembered)
  return { key, fitting, workflow, setPicked, many: fitting.length >= 2 }
}

// The ComfyUI choice runs the picked workflow, so it names that workflow's model and trial mark.
export function withWorkflow(choices: Choice[], workflow: WorkflowInfo | undefined): Choice[] {
  if (workflow === undefined) return choices
  return choices.map((c) =>
    c.provider.id === 'comfyui' && c.enabled
      ? { ...c, workflow, trial: workflow.status === 'trial', model: workflowModel(workflow) }
      : c,
  )
}

// What a ComfyUI video's length is read from: the picked workflow alone, so the seconds shown
// and sent are that workflow's.
export function infoFor(
  info: ComfyInfo | null,
  workflow: WorkflowInfo | undefined,
): ComfyInfo | null {
  return info !== null && workflow !== undefined ? { ...info, workflows: [workflow] } : info
}
