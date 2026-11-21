import { describe, it, expect } from 'vitest'
import { checkComfyVideo } from '@/main/commands/generation/comfy-video-checks'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
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

describe('the trial rule of generation.startVideo for ComfyUI [SPEC 14 1.41] (security class)', () => {
  it.each([
    [false, 'user', 'comfy_job_not_offered'],
    [true, 'agent', 'accepted'],
    [false, 'agent', 'comfy_job_not_offered'],
    [true, 'user', 'accepted'],
  ] as const)('dev tools %s, actor %s: %s', (devTools, actor, outcome) => {
    expect(reasonOf(() => checkComfyVideo(deps(devTools), { actor }, 2_000))).toBe(outcome)
  })

  it('no address saved: comfy_address_needed', () => {
    const none = {
      devTools: true,
      settings: { get: () => ({ comfyui: { baseUrl: null } }) as Settings },
    }
    expect(reasonOf(() => checkComfyVideo(none, { actor: 'user' }, 2_000))).toBe(
      'comfy_address_needed',
    )
  })

  it('a clip over the workflow maxMs: video_too_long', () => {
    expect(reasonOf(() => checkComfyVideo(deps(true), { actor: 'user' }, 15_001))).toBe(
      'video_too_long',
    )
    expect(reasonOf(() => checkComfyVideo(deps(true), { actor: 'user' }, 15_000))).toBe('accepted')
  })
})

describe('checkComfyVideo takes the start pair [SPEC 14 1.60 CU-6b N-4 step 3] (security class)', () => {
  const frame = { firstFrame: true, references: false }
  const refs = { firstFrame: false, references: true }

  it.each([
    [frame, 'h3-image-to-video'],
    [refs, 'h3-reference-to-video'],
    [{ firstFrame: false, references: false }, 'h3-text-to-video'],
  ])('the user and the agent with dev tools on get the workflow for %o: %s', (pair, id) => {
    expect(checkComfyVideo(deps(true), { actor: 'user' }, 2_000, pair).id).toBe(id)
    expect(checkComfyVideo(deps(true), { actor: 'agent' }, 2_000, pair).id).toBe(id)
  })

  it.each([
    [false, 'user', frame],
    [false, 'user', refs],
  ] as const)('dev tools %s, actor %s, picture start: comfy_job_not_offered', (dt, actor, pair) => {
    expect(reasonOf(() => checkComfyVideo(deps(dt), { actor }, 2_000, pair))).toBe(
      'comfy_job_not_offered',
    )
  })
})

describe('the video workflow matches the start pair [SPEC 14 1.53]', () => {
  it('a prompt-only run picks h3-text-to-video even when another video workflow is trial', () => {
    const list = WORKFLOWS.map((w) => (w.job === 'video' ? { ...w, status: 'trial' as const } : w))
    const who = { devTools: true, actor: 'user' as const }
    const choice = { job: 'video' as const, videoStart: { firstFrame: false, references: false } }
    expect(offeredWorkflow(choice, who, list)?.id).toBe('h3-text-to-video')
    const moved = list.filter((w) => w.id !== 'h3-text-to-video')
    expect(offeredWorkflow(choice, who, moved)).toBeNull()
  })
})
