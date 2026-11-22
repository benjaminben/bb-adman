// Gives the window's nav store (spec/editor.md, "What each tab keeps") to the components
// below. The shell makes the store; a NavScope inside another one uses the outer store, so a
// screen drawn on its own (the project page, the campaign page) still has one. R2-Q: beside
// it, the one project whose "+" asked for a new campaign, until its project home opens the
// brief form.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createNavStore, type NavStore, type NavStoreState } from '@/renderer/stores/nav-store'

type NewCampaignAsk = {
  askedFor: string | null
  ask: (projectId: string | null) => void
}

type Scope = { nav: NavStore; newCampaign: StoreApi<NewCampaignAsk> }

const NavContext = createContext<Scope | null>(null)

function createScope(): Scope {
  const newCampaign = createStore<NewCampaignAsk>((set) => ({
    askedFor: null,
    ask: (projectId) => set({ askedFor: projectId }),
  }))
  return { nav: createNavStore(), newCampaign }
}

export function NavScope(props: { children: ReactNode }) {
  const outer = useContext(NavContext)
  const [own] = useState(() => outer ?? createScope())
  if (outer) return props.children
  return <NavContext.Provider value={own}>{props.children}</NavContext.Provider>
}

function useScope(): Scope {
  const scope = useContext(NavContext)
  if (!scope) throw new Error('NavScope is missing')
  return scope
}

export function useNavStore(): NavStore {
  return useScope().nav
}

export function useNav<T>(select: (s: NavStoreState) => T): T {
  return useStore(useNavStore(), select)
}

// The "+" asks with its project; the project home answers and clears it with null.
export function useNewCampaignAsk(): NewCampaignAsk {
  return useStore(useScope().newCampaign)
}
