// An in-memory window.api for component tests. Commands and queries are recorded,
// and answers can be scripted per name.
import { vi } from 'vitest'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AppState } from '@/shared/schemas/queries/app'
import type { EventMap, EventName } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'

type Answer = (input: unknown) => Result<unknown> | Promise<Result<unknown>>

export function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    settings: {
      defaultProjectDir: '/Users/me/Documents/Adman Projects',
      recentProjects: [],
      defaultProviders: {
        image: 'gemini',
        layout: 'gemini',
        text: 'gemini',
        video: 'comfyui',
      },
      generation: { optionsPerRun: 4 },
      export: { imageFormat: 'png', jpgQuality: 90, fps: 30 },
      mcp: { enabled: false, port: 47821, autoApproveDestructive: false },
      storage: { s3: null, dropbox: null },
      comfyui: { baseUrl: null },
      agentRuns: {},
      agentRunLimit: 4,
      licenceConfirmed: [],
    },
    recentProjects: [],
    openProjects: [],
    providers: [
      {
        id: 'gemini',
        label: 'Google Gemini',
        jobs: ['image', 'layout', 'text'],
        available: true,
        secrets: ['gemini.apiKey'],
        defaultModels: {},
        local: false,
        cancel: 'none',
        serverText: false,
      },
      {
        id: 'fal-seedance',
        label: 'fal.ai Seedance',
        jobs: ['video'],
        // SPEC 14 1.59 L-7: as the real registry (1.58 J-2), not available in this build.
        available: false,
        secrets: ['fal.apiKey'],
        defaultModels: {},
        local: false,
        cancel: 'may_finish',
        serverText: false,
      },
      {
        id: 'firefly',
        label: 'Adobe Firefly',
        jobs: ['image'],
        available: false,
        secrets: ['firefly.clientId', 'firefly.clientSecret'],
        defaultModels: {},
        local: false,
        cancel: 'none',
        serverText: false,
      },
    ],
    secrets: [],
    devTools: false,
    ...overrides,
  }
}

export function makeFakeApi(initial: AppState = baseState()) {
  let state = initial
  const commands: Array<{ name: string; input: unknown }> = []
  const queries: Array<{ name: string; input: unknown }> = []
  const commandAnswers = new Map<string, Answer>()
  const queryAnswers = new Map<string, Answer>()
  const listeners = new Map<string, Set<(p: unknown) => void>>()

  // agentRuns.setAllowed and agentRuns.setLimit change the state, as the real commands do, so
  // the next app.getState shows them.
  function agentRunsCommand(name: string, input: unknown): Result<unknown> | null {
    const settings = state.settings
    if (name === 'agentRuns.setAllowed') {
      const { provider, allowed } = input as { provider: string; allowed: boolean }
      const agentRuns = { ...settings.agentRuns, [provider]: { allowed } }
      state = { ...state, settings: { ...settings, agentRuns } }
      return { ok: true, data: { provider, allowed } }
    }
    if (name === 'agentRuns.setLimit') {
      const { limit } = input as { limit: number }
      state = { ...state, settings: { ...settings, agentRunLimit: limit } }
      return { ok: true, data: { limit } }
    }
    return null
  }

  const api: AdmanApi = {
    command: vi.fn(async (name: string, input: unknown): Promise<Result<unknown>> => {
      commands.push({ name, input })
      const answer = commandAnswers.get(name)
      if (answer) return answer(input)
      return agentRunsCommand(name, input) ?? { ok: true, data: null }
    }),
    query: vi.fn(async (name: string, input?: unknown): Promise<Result<unknown>> => {
      queries.push({ name, input })
      const answer = queryAnswers.get(name)
      if (answer) return answer(input)
      if (name === 'app.getState') return { ok: true, data: state }
      return { ok: true, data: null }
    }),
    on: vi.fn(<E extends EventName>(event: E, listener: (payload: EventMap[E]) => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener as (p: unknown) => void)
      listeners.set(event, set)
      return () => set.delete(listener as (p: unknown) => void)
    }),
  }

  return {
    api,
    commands,
    queries,
    setState: (next: AppState) => {
      state = next
    },
    onCommand: (name: string, answer: Answer) => commandAnswers.set(name, answer),
    onQuery: (name: string, answer: Answer) => queryAnswers.set(name, answer),
    emit: <E extends EventName>(event: E, payload: EventMap[E]) => {
      listeners.get(event)?.forEach((fn) => fn(payload))
    },
  }
}
