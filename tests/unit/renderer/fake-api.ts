// An in-memory window.api for component tests. Commands and queries are recorded,
// and answers can be scripted per name.
import { vi } from 'vitest'
import type { AdmanApi } from '../../../src/shared/schemas/api'
import type { AppState } from '../../../src/shared/schemas/queries/app'
import type { EventMap, EventName } from '../../../src/shared/schemas/events'
import type { Result } from '../../../src/shared/schemas/result'

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
        video: 'fal-seedance',
      },
      generation: { optionsPerRun: 4 },
      export: { imageFormat: 'png', jpgQuality: 90, fps: 30 },
      mcp: { enabled: false, port: 47821, autoApproveDestructive: false },
      storage: { s3: null, dropbox: null },
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
      },
      {
        id: 'fal-seedance',
        label: 'fal.ai Seedance',
        jobs: ['video'],
        available: true,
        secrets: ['fal.apiKey'],
        defaultModels: {},
      },
      {
        id: 'firefly',
        label: 'Adobe Firefly',
        jobs: ['image'],
        available: false,
        secrets: ['firefly.clientId', 'firefly.clientSecret'],
        defaultModels: {},
      },
    ],
    secrets: [],
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

  const api: AdmanApi = {
    command: vi.fn(async (name: string, input: unknown): Promise<Result<unknown>> => {
      commands.push({ name, input })
      const answer = commandAnswers.get(name)
      return answer ? answer(input) : { ok: true, data: null }
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
