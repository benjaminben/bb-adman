// spec/editor.md, "Keys for the tabs" [FR-242, A-23]: for the shown project, the next and
// previous variant tab of the shown campaign, and the next and previous campaign tab. The
// shortcut table owns the keys; they work wherever the focus is, text fields included. On the
// Project tab there are no variant tabs, so the variant keys are left alone.
import { useEffect } from 'react'
import { useNavStore } from '@/renderer/app/nav-context'
import { platform } from '@/renderer/editor/use-editor-key'
import { PROJECT_TAB, projectNav, type NavStoreState } from '@/renderer/stores/nav-store'
import { matchShortcut, type ShortcutName } from '@/renderer/ui/shortcuts'

type Step = (s: NavStoreState, projectId: string) => boolean

const variantStep =
  (step: 1 | -1): Step =>
  (s, projectId) => {
    const campaignId = projectNav(s, projectId).shown
    if (campaignId === PROJECT_TAB) return false
    s.stepVariant(projectId, campaignId, step)
    return true
  }

const campaignStep =
  (step: 1 | -1): Step =>
  (s, projectId) => {
    s.stepCampaign(projectId, step)
    return true
  }

const KEYS: [ShortcutName, Step][] = [
  ['nextVariantTab', variantStep(1)],
  ['previousVariantTab', variantStep(-1)],
  ['nextCampaignTab', campaignStep(1)],
  ['previousCampaignTab', campaignStep(-1)],
]

export function useTabKeys(projectId: string | null): void {
  const store = useNavStore()
  useEffect(() => {
    if (projectId === null) return
    const onKey = (event: KeyboardEvent) => {
      const found = KEYS.find(([name]) => matchShortcut(event, name, platform))
      if (found && found[1](store.getState(), projectId)) event.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [store, projectId])
}
