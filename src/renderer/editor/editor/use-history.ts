// spec/editor.md, "Top bar" and "Undo and redo per variant" [FR-095]: history.state for the
// variant's list, read at the start, after every project.changed naming the variant, and after
// each undo or redo. Undo and redo go through the app store, so a refusal shows in the banner.
import { useCallback, useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { ProjectChangedPayload } from '@/shared/schemas/events'
import type { HistoryState } from '@/shared/schemas/queries/history'

export type VariantHistory = HistoryState & { undo: () => void; redo: () => void }

function namesVariant(event: ProjectChangedPayload, variantId: string): boolean {
  return (
    (event.changed.variant ?? []).some((row) => row.id === variantId) ||
    (event.changed.layer ?? []).some((row) => row.variantId === variantId)
  )
}

export function useHistory(projectId: string, variantId: string): VariantHistory {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [state, setState] = useState<HistoryState>({ canUndo: false, canRedo: false })
  // Goes up after each undo or redo, so the state is read again.
  const [acted, setActed] = useState(0)
  const scope = `variant:${variantId}`

  useEffect(() => {
    let live = true
    const read = () =>
      void api.query('history.state', { projectId, scope }).then((result) => {
        if (live && result.ok && result.data) setState(result.data as HistoryState)
      })
    read()
    const stop = api.on('project.changed', (event) => {
      if (event.projectId === projectId && namesVariant(event, variantId)) read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, variantId, scope, acted])

  const act = useCallback(
    (name: 'history.undo' | 'history.redo') =>
      void command(name, { projectId, scope }).then(() => setActed((n) => n + 1)),
    [command, projectId, scope],
  )

  return { ...state, undo: () => act('history.undo'), redo: () => act('history.redo') }
}
