// What an open workflow ask names, read once from agent.askWorkflow with its request ID
// (spec/comfyui-custom.md, "The agent's ask"). It lives in this hook's state only: never in a
// store, a log, an event or a command. The name, the job words and the node count are kept
// apart, so a name that reads like job words cannot pass for them. The job words come from the
// one owner, built from the reply's job and start; the reply has no reference count, so the
// count is the one (0 to 8) for which the main process's target line is exactly
// `Workflow "{name}": {job words}, {n} node types`. A refused or thrown query, a reply of
// another shape, an empty list or a reply that does not match the target counts as failed,
// and a failed ask is never allowed.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { jobWords } from '@/shared/comfy/workflow-words'
import type { CustomJob, WorkflowStart } from '@/shared/comfy/custom-workflow'

export type WorkflowFacts = { name: string; job: string; count: string; nodeTypes: string[] }

export type AskWorkflow =
  { status: 'loading' } | { status: 'failed' } | ({ status: 'shown' } & WorkflowFacts)

const JOBS: readonly unknown[] = ['image', 'image_refs', 'video']
const STARTS: readonly unknown[] = ['prompt', 'first_frame', 'references', null]
const MAX_REFERENCES = 8

export const typeCount = (n: number) => (n === 1 ? '1 node type' : `${n} node types`)

function readFacts(data: unknown, target: string): WorkflowFacts | null {
  if (typeof data !== 'object' || data === null) return null
  const { name, job, start, nodeTypes } = data as Record<string, unknown>
  if (typeof name !== 'string' || !JOBS.includes(job) || !STARTS.includes(start)) return null
  if (!Array.isArray(nodeTypes) || nodeTypes.length === 0) return null
  if (!nodeTypes.every((type) => typeof type === 'string')) return null
  const count = typeCount(nodeTypes.length)
  for (let references = 0; references <= MAX_REFERENCES; references++) {
    const words = jobWords(job as CustomJob, start as WorkflowStart | null, references)
    if (target === `Workflow "${name}": ${words}, ${count}`) {
      return { name, job: words, count, nodeTypes }
    }
  }
  return null
}

// `wanted` is false for every other kind of ask, which asks nothing.
export function useAskWorkflow(requestId: string, target: string, wanted: boolean): AskWorkflow {
  const api = useApi()
  const [state, setState] = useState<AskWorkflow>({ status: 'loading' })
  useEffect(() => {
    if (!wanted) return
    let live = true
    const fail = () => {
      if (live) setState({ status: 'failed' })
    }
    api.query('agent.askWorkflow', { requestId }).then((result) => {
      const facts = result.ok ? readFacts(result.data, target) : null
      if (facts === null) fail()
      else if (live) setState({ status: 'shown', ...facts })
    }, fail)
    return () => {
      live = false
    }
  }, [api, requestId, target, wanted])
  return state
}
