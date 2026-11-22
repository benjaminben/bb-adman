import { describe, it, expect, vi } from 'vitest'
import { checkComfyRun } from '@/main/commands/generation/comfy-checks'
import type { Settings } from '@/shared/schemas/settings'

// [D-103] The shipped workflows are proven. This file proves the trial rule, so it runs on
// a copy of the list where each of them is a trial (tests/helpers/trial-workflows.ts).
vi.mock('@/main/providers/comfyui/workflows', async (load) =>
  (await import('../../../../helpers/trial-workflows')).asTrial(await load()),
)

const deps = (devTools: boolean) => ({
  devTools,
  settings: { get: () => ({ comfyui: { baseUrl: 'http://192.0.2.5:8188' } }) as Settings },
})

const reasonOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    return (e as { details?: { reason?: string } }).details?.reason
  }
  return 'accepted'
}

describe('the trial rule of generation.runImages for ComfyUI [SPEC 14 1.41] (security class)', () => {
  it.each([
    [false, 'user', 0, 'comfy_job_not_offered'],
    [true, 'agent', 0, 'accepted'],
    [true, 'agent', 1, 'accepted'],
    [false, 'agent', 0, 'comfy_job_not_offered'],
    [false, 'user', 1, 'comfy_job_not_offered'],
    [true, 'user', 0, 'accepted'],
    [true, 'user', 1, 'accepted'],
  ] as const)('dev tools %s, actor %s, %i reference(s): %s', (devTools, actor, refs, outcome) => {
    expect(reasonOf(() => checkComfyRun(deps(devTools), { actor }, refs))).toBe(outcome)
  })
})
