// Made-up providers and state for the Settings "Agent runs" tests (spec/agent-runs.md,
// "Settings block").
import type { AppState, ProviderInfo } from '@/shared/schemas/queries/app'
import { baseState, makeFakeApi } from '../../fake-api'

export function provider(over: Partial<ProviderInfo> & { id: string }): ProviderInfo {
  return {
    label: over.id,
    jobs: ['image'],
    available: true,
    secrets: [],
    defaultModels: {},
    local: true,
    cancel: 'stops',
    serverText: false,
    ...over,
  }
}

export const COMFY = provider({ id: 'comfyui', label: 'ComfyUI', jobs: ['image', 'video'] })

export function agentRunsFake(
  providers: ProviderInfo[],
  settings: Partial<AppState['settings']> = {},
) {
  const base = baseState()
  return makeFakeApi(
    baseState({
      providers: [...providers, ...base.providers],
      settings: { ...base.settings, ...settings },
    }),
  )
}

export const tickName = (label: string) => `Let agents start runs with ${label}`
export const LIMIT = 'Run limit'
export const PAID =
  'Paid. Each run an agent starts is charged to your account, with no click from you.'
