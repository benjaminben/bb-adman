// The node types of an open workflow ask, read once from agent.askWorkflow with its request ID
// (spec/comfyui-custom.md, "The agent's ask"). They live in this hook's state only: never in a
// store, a log, an event or a command. A refused or thrown query, a reply of another shape or
// an empty list counts as failed, and a failed list never lets the ask be allowed.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'

export type AskWorkflow =
  { status: 'loading' } | { status: 'failed' } | { status: 'shown'; nodeTypes: string[] }

function readTypes(data: unknown): string[] | null {
  if (typeof data !== 'object' || data === null || !('nodeTypes' in data)) return null
  const types: unknown = data.nodeTypes
  if (!Array.isArray(types) || types.length === 0) return null
  return types.every((type) => typeof type === 'string') ? types : null
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
      const nodeTypes = result.ok ? readTypes(result.data) : null
      if (nodeTypes === null) fail()
      else if (live) setState({ status: 'shown', nodeTypes })
    }, fail)
    return () => {
      live = false
    }
  }, [api, requestId, wanted])
  return state
}
