// spec/screens-variants.md, "The overview", campaign-undo/: Undo and Redo for the campaign's
// own list (scope campaign:{id}). Enabled from history.state, read on mount and again on each
// project.changed for the project. Sent through the app store, so a refusal shows in the banner.
// Keys: the undo and redo entries of SHORTCUTS, only while the overview tab is shown and the
// focus is not in a text field; a variant tab's editor keeps its own keys. Deleting a variant or
// a direction is not on this list (D-099).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useNav } from '@/renderer/app/nav-context'
import { platform } from '@/renderer/editor/use-editor-key'
import { OVERVIEW_TAB, campaignNav } from '@/renderer/stores/nav-store'
import { Icon } from '@/renderer/ui/icon'
import { matchShortcut } from '@/renderer/ui/shortcuts'
import type { HistoryState } from '@/shared/schemas/queries/history'
import layout from '@/renderer/ui/layout.module.css'

type Props = { projectId: string; campaignId: string }
type Act = 'history.undo' | 'history.redo'

const FIELDS = 'input, textarea, select, [contenteditable="true"]'
const inField = (target: EventTarget | null) =>
  target instanceof Element && target.closest(FIELDS) !== null

function useCampaignHistory(projectId: string, scope: string): HistoryState {
  const api = useApi()
  const [state, setState] = useState<HistoryState>({ canUndo: false, canRedo: false })
  useEffect(() => {
    let live = true
    const read = () =>
      void api.query('history.state', { projectId, scope }).then((result) => {
        if (live && result.ok && result.data) setState(result.data as HistoryState)
      })
    read()
    const stop = api.on('project.changed', (event) => {
      if (event.projectId === projectId) read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, scope])
  return state
}

export function CampaignUndo(props: Props) {
  const { projectId, campaignId } = props
  const command = useApp((s) => s.command)
  const scope = `campaign:${campaignId}`
  const state = useCampaignHistory(projectId, scope)
  const overview = useNav((s) => campaignNav(s, projectId, campaignId).shown === OVERVIEW_TAB)
  const send = useCallback(
    (name: Act) => void command(name, { projectId, scope }),
    [command, projectId, scope],
  )
  const latest = useRef(send)
  useEffect(() => {
    latest.current = send
  }, [send])

  useEffect(() => {
    if (!overview) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || inField(event.target)) return
      const name: Act | null = matchShortcut(event, 'undo', platform)
        ? 'history.undo'
        : matchShortcut(event, 'redo', platform)
          ? 'history.redo'
          : null
      if (!name) return
      event.preventDefault()
      latest.current(name)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overview])

  return (
    <div role="group" aria-label="Campaign changes" className={layout.row}>
      <button type="button" disabled={!state.canUndo} onClick={() => send('history.undo')}>
        <Icon name="undo" />
        Undo
      </button>
      <button type="button" disabled={!state.canRedo} onClick={() => send('history.redo')}>
        <Icon name="redo" />
        Redo
      </button>
    </div>
  )
}
