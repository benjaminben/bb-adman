// R2E-10 (spec/phases/round-2-editor.md D8): which step of the first-run setup is open, and
// the rule that opens it by itself. A renderer runs one window, so this store is per window.
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useApp } from '@/renderer/app/app-context'

type FirstRunState = { step: number | null }

export const useFirstRunStore = create<FirstRunState>(() => ({ step: null }))

export function showStep(step: number | null): void {
  useFirstRunStore.setState({ step })
}

// The Settings card opens it at the welcome step whatever the mark says.
export function openSetup(): void {
  showStep(0)
}

export function closeSetup(): void {
  showStep(null)
}

// Decided once, when the app state first arrives: the start screen, no mark, no key of any
// kind saved.
export function useFirstRunRule(): void {
  const app = useApp((s) => s.app)
  const view = useApp((s) => s.view)
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current || app === null) return
    decided.current = true
    if (view.kind === 'start' && !app.settings.setup.done && app.secrets.length === 0) {
      openSetup()
    }
  }, [app, view])
}
