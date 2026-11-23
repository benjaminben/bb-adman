// What an open workflow ask names, read once from agent.askWorkflow with its request ID
// (spec/comfyui-custom.md, "The agent's ask"). It lives in this hook's state only: never in a
// store, a log, an event or a command. The name, the job words and the node count are kept
// apart, so a name that reads like job words cannot pass for them. The job words come from the
// one owner, built from the reply's job, start and reference count; the target line is never
// read. A refused or thrown query, a reply of another shape (a reference count that is not a
// whole number from 0 to 8 among them) or an empty list counts as failed, and a failed ask is
// never allowed.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { jobWords, nodeTypeCount } from '@/shared/comfy/workflow-words'
import type { CustomJob, WorkflowStart } from '@/shared/comfy/custom-workflow'

export type WorkflowFacts = { name: string; job: string; count: string; nodeTypes: string[] }

export type AskWorkflow =
  { status: 'loading' } | { status: 'failed' } | ({ status: 'shown' } & WorkflowFacts)

const JOBS: readonly unknown[] = ['image', 'image_refs', 'video']
const STARTS: readonly unknown[] = ['prompt', 'first_frame', 'references', null]

function readFacts(data: unknown): WorkflowFacts | null {
  if (typeof data !== 'object' || data === null) return null
  const { name, job, start, nodeTypes, references } = data as Record<string, unknown>
  if (typeof name !== 'string' || !JOBS.includes(job) || !STARTS.includes(start)) return null
  if (typeof references !== 'number' || !Number.isInteger(references)) return null
  if (references < 0 || references > MAX_REFERENCES_PER_RUN) return null
  if (!Array.isArray(nodeTypes) || nodeTypes.length === 0) return null
  if (!nodeTypes.every((type) => typeof type === 'string')) return null
  const words = jobWords(job as CustomJob, start as WorkflowStart | null, references)
  return { name, job: words, count: nodeTypeCount(nodeTypes.length), nodeTypes }
}

// `wanted` is false for every other kind of ask, which asks nothing.
export function useAskWorkflow(requestId: string, wanted: boolean): AskWorkflow {
  const api = useApi()
  const [state, setState] = useState<AskWorkflow>({ status: 'loading' })
  useEffect(() => {
    if (!wanted) return
    let live = true
    const fail = () => {
      if (live) setState({ status: 'failed' })
    }
    api.query('agent.askWorkflow', { requestId }).then((result) => {
      const facts = result.ok ? readFacts(result.data) : null
      if (facts === null) fail()
      else if (live) setState({ status: 'shown', ...facts })
    }, fail)
    return () => {
      live = false
    }
  }, [api, requestId, wanted])
  return state
}
