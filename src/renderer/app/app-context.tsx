import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AppStore, AppStoreState } from '@/renderer/stores/app-store'

type Ctx = { api: AdmanApi; store: AppStore }

const AppContext = createContext<Ctx | null>(null)

export function AppProvider(props: { api: AdmanApi; store: AppStore; children: ReactNode }) {
  return (
    <AppContext.Provider value={{ api: props.api, store: props.store }}>
      {props.children}
    </AppContext.Provider>
  )
}

function useCtx(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppProvider is missing')
  return ctx
}

// Selectors must return stable values; a fresh [] on each call makes React loop.
export const EMPTY: readonly never[] = Object.freeze([])

export function useApp<T>(select: (s: AppStoreState) => T): T {
  return useStore(useCtx().store, select)
}

export function useApi(): AdmanApi {
  return useCtx().api
}

// Asks the main process to show a native picker; returns null when cancelled.
export async function pickPath(
  api: AdmanApi,
  query: 'dialog.pickFolder' | 'dialog.pickProjectFile',
  defaultPath?: string,
): Promise<string | null> {
  const result = await api.query(query, { defaultPath })
  if (!result.ok) return null
  const data = result.data as { path: string | null } | null
  return data?.path ?? null
}
