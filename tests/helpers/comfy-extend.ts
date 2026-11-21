// For P5-7's tests: a test-only `trial` copy of the draft `moss-extend`, an adapter that may
// use it, and an extend input. The check is told to compare the trial copy too, since the
// shipped list holds no extend workflow while `moss-extend` is a draft. Nothing here contacts
// a real server.
import type { StandIn } from './comfy-stand-in'
import { comfyContext, fakeTiming } from './comfy-run'
import { comfyImage } from '@/main/providers/comfyui/image'
import { createServerChecks, type ServerChecks } from '@/main/providers/comfyui/needs'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { mossExtend } from '@/main/providers/comfyui/workflows/moss'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { ImageFile } from '@/main/providers/types'
import { greyPng } from '@/main/providers/fake/png'

export const trialExtend: WorkflowSpec = { ...mossExtend, status: 'trial' }

export function extender(
  s: StandIn,
  afterCheck?: () => void,
  workflows: readonly WorkflowSpec[] = [trialExtend],
) {
  const real = createServerChecks()
  const checks: ServerChecks = {
    async run(origin, client) {
      const result = await real.run(origin, client, [...NON_DRAFT_WORKFLOWS, ...workflows])
      afterCheck?.()
      return result
    },
  }
  const { timing } = fakeTiming()
  return comfyImage(
    comfyContext(() => s.origin),
    { timing, checks, workflows },
  )
}

const picture: ImageFile = { bytes: greyPng(9, 9), mime: 'image/png' }

export function extendInput(
  box: { x: number; y: number; width: number; height: number },
  width = 1920,
  height = 1080,
) {
  const placement = { ...box, rotation: 0, crop: null }
  return { image: picture, placement, width, height, prompt: 'extend the background' }
}

export function submittedGraph(s: StandIn) {
  const body = s.seen.find((r) => r.method === 'POST' && r.path === '/prompt')?.body
  const sent = JSON.parse(body?.toString('utf8') ?? '{}') as {
    prompt?: Record<string, { inputs: Record<string, unknown> }>
  }
  return sent.prompt ?? {}
}
