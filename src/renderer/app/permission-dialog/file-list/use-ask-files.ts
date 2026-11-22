// The paths of an open import ask, read once from agent.askFiles with its request ID
// (spec/phases/round-2-platform.md, D7). They live in this hook's state only: never in a
// store, a log, an event or a command. A refused or thrown query, a reply of another shape,
// or a list whose length is not the ask's fileCount counts as failed.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'

export type AskFiles =
  { status: 'loading' } | { status: 'failed' } | { status: 'shown'; files: string[] }

function readFiles(data: unknown, count: number): string[] | null {
  if (typeof data !== 'object' || data === null || !('files' in data)) return null
  const files: unknown = data.files
  if (!Array.isArray(files) || files.length !== count || count === 0) return null
  return files.every((file) => typeof file === 'string') ? files : null
}

// `wanted` is false for a delete ask, which names no files and asks nothing.
export function useAskFiles(requestId: string, fileCount: number, wanted: boolean): AskFiles {
  const api = useApi()
  const [state, setState] = useState<AskFiles>({ status: 'loading' })
  useEffect(() => {
    if (!wanted) return
    let live = true
    const fail = () => {
      if (live) setState({ status: 'failed' })
    }
    api.query('agent.askFiles', { requestId }).then((result) => {
      const files = result.ok ? readFiles(result.data, fileCount) : null
      if (files === null) fail()
      else if (live) setState({ status: 'shown', files })
    }, fail)
    return () => {
      live = false
    }
  }, [api, requestId, fileCount, wanted])
  return state
}
