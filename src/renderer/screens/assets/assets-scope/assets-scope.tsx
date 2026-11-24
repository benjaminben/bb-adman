// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "How it opens"): whether the
// project's Assets panel is open, and the button that opened it, so closing gives that button
// the focus back. One scope per project page; null outside one. D-109: `available` is false
// while the page cannot draw the panel (the project home, which draws the library itself), so
// nothing offers to open it there.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export const ASSETS_PANEL_ID = 'assets-panel'

export type AssetsPanelControl = {
  projectId: string
  open: boolean
  available: boolean
  show(opener: HTMLElement | null): void
  hide(): void
}

const Scope = createContext<AssetsPanelControl | null>(null)

type ScopeProps = { projectId: string; available?: boolean; children: ReactNode }

export function AssetsScope(props: ScopeProps) {
  const available = props.available ?? true
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const show = useCallback((by: HTMLElement | null) => {
    opener.current = by
    setOpen(true)
  }, [])
  const hide = useCallback(() => {
    setOpen(false)
    opener.current?.focus()
    opener.current = null
  }, [])
  const control = useMemo(
    () => ({ projectId: props.projectId, open, available, show, hide }),
    [props.projectId, open, available, show, hide],
  )
  return <Scope.Provider value={control}>{props.children}</Scope.Provider>
}

export function useAssetsPanel(): AssetsPanelControl | null {
  return useContext(Scope)
}
