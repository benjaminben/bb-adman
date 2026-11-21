import { describe, it, expect } from 'vitest'
import { checkComfyRun } from '@/main/commands/generation/comfy-checks'
import type { Settings } from '@/shared/schemas/settings'

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
    [true, 'agent', 0, 'comfy_job_not_offered'],
    [true, 'agent', 1, 'comfy_job_not_offered'],
    [false, 'user', 1, 'comfy_job_not_offered'],
    [true, 'user', 0, 'accepted'],
    [true, 'user', 1, 'accepted'],
  ] as const)('dev tools %s, actor %s, %i reference(s): %s', (devTools, actor, refs, outcome) => {
    expect(reasonOf(() => checkComfyRun(deps(devTools), { actor }, refs))).toBe(outcome)
  })
})
