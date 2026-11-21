// Gives the window's activity store (spec/screens-ai.md, "The activity panel", Store) to the
// button and the panel. It follows job.updated for the window's life and reads job.activity
// again whenever the shown project changes (null on the start screen and in Settings).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import {
  createActivityStore,
  type ActivityStore,
  type ActivityStoreState,
} from '@/renderer/stores/activity-store'

const ActivityContext = createContext<ActivityStore | null>(null)

export function ActivityScope(props: { projectId: string | null; children: ReactNode }) {
  const api = useApi()
  const [store] = useState(() => createActivityStore({ api }))
  useEffect(() => store.getState().subscribe(), [store])
  useEffect(() => void store.getState().load(props.projectId), [store, props.projectId])
  return <ActivityContext.Provider value={store}>{props.children}</ActivityContext.Provider>
}

export function useActivity<T>(select: (s: ActivityStoreState) => T): T {
  const store = useContext(ActivityContext)
  if (!store) throw new Error('ActivityScope is missing')
  return useStore(store, select)
}

// The scope for the window: the shown project is the one the app view shows, if it is open.
export function ShownActivityScope(props: { children: ReactNode }) {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const shownId = view.kind === 'project' ? view.projectId : null
  const open = projects.some((p) => p.projectId === shownId)
  return <ActivityScope projectId={open ? shownId : null}>{props.children}</ActivityScope>
}
