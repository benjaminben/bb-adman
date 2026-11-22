// App-wide window state (ADR-003): a copy of app.getState, the visible tab, the last
// error, and the dialog requests of the ask-then-send-again flows: the key dialog for
// NEEDS_KEY (FR-171), and for the three run commands the address dialog (FR-255) and the
// licence dialog (D-088, S2-6). Each kind is asked at most once per call.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AppState, ProviderInfo } from '@/shared/schemas/queries/app'
import type { Result } from '@/shared/schemas/result'
import { addModel, runAsk, withLicenceFlag } from './run-asks'

export type View = { kind: 'start' } | { kind: 'settings' } | { kind: 'project'; projectId: string }

export type KeyRequest = { provider: ProviderInfo; resolve: (saved: boolean) => void }
export type AddressRequest = { resolve: (saved: boolean) => void }
// `remember` is the model label to save in settings.licenceConfirmed (the ticked box).
export type LicenceAnswer = { confirmed: boolean; remember: string | null }
export type LicenceRequest = {
  workflow: string
  saving: boolean
  resolve: (answer: LicenceAnswer) => void
}

export type AppStoreState = {
  app: AppState | null
  view: View
  error: string | null
  keyRequest: KeyRequest | null
  addressRequest: AddressRequest | null
  licenceRequest: LicenceRequest | null
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

    async function askForAddress(): Promise<boolean> {
      const saved = await new Promise<boolean>((resolve) => set({ addressRequest: { resolve } }))
      set({ addressRequest: null })
      return saved
    }

    // Gives whether to send again, and a refused save of the ticked model for the banner.
    async function askForLicence(workflow: string) {
      const answer = await new Promise<LicenceAnswer>((resolve) =>
        set({ licenceRequest: { workflow, saving: false, resolve } }),
      )
      let refused: string | null = null
      if (answer.confirmed && answer.remember !== null) {
        const open = get().licenceRequest
        if (open) set({ licenceRequest: { ...open, saving: true } })
        const list = get().app?.settings.licenceConfirmed ?? []
        const licenceConfirmed = addModel(list, answer.remember)
        const saved = await get().command('settings.update', { licenceConfirmed })
        if (!saved.ok) refused = saved.error.message
      }
      set({ licenceRequest: null })
      return { send: answer.confirmed, refused }
    }

    return {
      app: null,
      view: { kind: 'start' },
      error: null,
      keyRequest: null,
      addressRequest: null,
      licenceRequest: null,

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
        const asked = new Set<string>()
        let sent = input
        let kept: string | null = null
        for (;;) {
          const result = await api.command(name, sent)
          if (!result.ok && result.error.code === 'NEEDS_KEY') {
            if (await askForKey(result.error.details?.provider)) continue
            return result
          }
          const ask = result.ok ? null : runAsk(name, result.error)
          if (ask && !asked.has(ask.kind)) {
            asked.add(ask.kind)
            if (ask.kind === 'address') {
              if (await askForAddress()) continue
              return result
            }
            const licence = await askForLicence(ask.workflow)
            if (!licence.send) return result
            sent = withLicenceFlag(sent)
            kept = licence.refused
            continue
          }
          if (!result.ok) {
            set({ error: result.error.message })
            return result
          }
          set({ error: kept })
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
