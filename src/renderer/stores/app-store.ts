// App-wide window state (ADR-003): a copy of app.getState, the visible tab, the last
// error, and the key dialog request for the NEEDS_KEY flow (FR-171).
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '../../shared/schemas/api'
import type { AppState, ProviderInfo } from '../../shared/schemas/queries/app'
import type { Result } from '../../shared/schemas/result'

export type View = { kind: 'start' } | { kind: 'settings' } | { kind: 'project'; projectId: string }

export type KeyRequest = { provider: ProviderInfo; resolve: (saved: boolean) => void }

export type AppStoreState = {
  app: AppState | null
  view: View
  error: string | null
  keyRequest: KeyRequest | null
  refresh(): Promise<void>
  subscribe(): () => void
  show(view: View): void
  clearError(): void
  command(name: string, input: unknown): Promise<Result<unknown>>
}

export type AppStore = StoreApi<AppStoreState>

function openedProjectId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('projectId' in data)) return null
  return typeof data.projectId === 'string' ? data.projectId : null
}

export function createAppStore(api: AdmanApi): AppStore {
  return createStore<AppStoreState>((set, get) => {
    function nextView(app: AppState, before: AppState | null): View {
      // A project the window has not seen yet was opened by the system (double-click),
      // including before the window's first load; show the newest one.
      const known = new Set(before?.openProjects.map((p) => p.projectId) ?? [])
      const added = app.openProjects.filter((p) => !known.has(p.projectId)).at(-1)
      if (added) return { kind: 'project', projectId: added.projectId }
      const view = get().view
      if (
        view.kind === 'project' &&
        !app.openProjects.some((p) => p.projectId === view.projectId)
      ) {
        return { kind: 'start' }
      }
      return view
    }

    async function askForKey(providerId: unknown): Promise<boolean> {
      const provider = get().app?.providers.find((p) => p.id === providerId)
      if (!provider) return false
      const saved = await new Promise<boolean>((resolve) =>
        set({ keyRequest: { provider, resolve } }),
      )
      set({ keyRequest: null })
      return saved
    }

    return {
      app: null,
      view: { kind: 'start' },
      error: null,
      keyRequest: null,

      async refresh() {
        const result = await api.query('app.getState', {})
        if (!result.ok) return set({ error: result.error.message })
        const app = result.data as AppState
        set({ app, view: nextView(app, get().app) })
      },

      subscribe() {
        return api.on('app.stateChanged', () => void get().refresh())
      },

      show: (view) => set({ view, error: null }),
      clearError: () => set({ error: null }),

      async command(name, input) {
        for (;;) {
          const result = await api.command(name, input)
          if (!result.ok && result.error.code === 'NEEDS_KEY') {
            if (await askForKey(result.error.details?.provider)) continue
            return result
          }
          if (!result.ok) {
            set({ error: result.error.message })
            return result
          }
          set({ error: null })
          await get().refresh()
          const projectId = openedProjectId(result.data)
          if (projectId && (name === 'project.create' || name === 'project.open')) {
            set({ view: { kind: 'project', projectId } })
          }
          return result
        }
      },
    }
  })
}
