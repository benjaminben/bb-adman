// Gives the window's nav store (spec/editor.md, "What each tab keeps") to the components
// below. The shell makes the store; a NavScope inside another one uses the outer store, so a
// screen drawn on its own (the project page, the campaign page) still has one.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createNavStore, type NavStore, type NavStoreState } from '@/renderer/stores/nav-store'

const NavContext = createContext<NavStore | null>(null)

export function NavScope(props: { children: ReactNode }) {
  const outer = useContext(NavContext)
  const [own] = useState(() => outer ?? createNavStore())
  if (outer) return props.children
  return <NavContext.Provider value={own}>{props.children}</NavContext.Provider>
}

export function useNavStore(): NavStore {
  const store = useContext(NavContext)
  if (!store) throw new Error('NavScope is missing')
  return store
}

export function useNav<T>(select: (s: NavStoreState) => T): T {
  return useStore(useNavStore(), select)
}
