// Failed runs for workflow-5-1.spec.ts (P4-20, Phase 4 exit criterion 3; workflow 5.1 "Provider
// failure" and 5.8 "The run fails"). The fake provider's `fail` behaviour can be set only in
// the main process's own tests, so the failures come from outside the app: five Gemini error
// kinds from gemini-answers.ts, and a run the stand-in ComfyUI could not finish. "timeout" is
// checked in tests/unit/renderer/editor/failure-kinds.test.tsx. Not a test file itself.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { StandIn } from '../helpers/comfy-stand-in'
import { plainMessage, reasonMessage } from '@/shared/providers/messages'
import { answerGemini } from './gemini-answers'
import { command, query } from './render-helpers'
import { finishWithError, nthSentId } from './stand-in-runs'
import type { Place } from './workflow-5-1-steps'

export const GEMINI_KINDS = ['bad_key', 'quota', 'refused', 'offline', 'other'] as const

export const geminiSentence = (kind: (typeof GEMINI_KINDS)[number]) =>
  plainMessage(kind, 'Google Gemini')
export const COMFY_SENTENCE = reasonMessage('run_failed')

function runImages(page: Page, place: Place, layerId: string, provider: string) {
  const { projectId, variantId } = place
  const prompt = 'A lantern on a quiet harbour wall at dusk'
  return command(page, 'generation.runImages', {
    ...{ projectId, variantId, layerId, prompt, referenceAssetIds: [], count: 1, provider },
  }) as Promise<{ jobId: string }>
}

async function status(page: Page, projectId: string, jobId: string): Promise<string> {
  const rows = (await query(page, 'job.list', { projectId })) as unknown as {
    id: string
    status: string
    errorKind: string | null
  }[]
  const row = rows.find((r) => r.id === jobId)
  return `${row?.status}:${row?.errorKind}`
}

// One Gemini picture run per kind, each answered with that kind's failure.
export async function failEachGeminiKind(
  app: ElectronApplication,
  page: Page,
  place: Place,
  layerId: string,
): Promise<void> {
  for (const kind of GEMINI_KINDS) {
    await answerGemini(app, kind)
    const { jobId } = await runImages(page, place, layerId, 'gemini')
    await expect
      .poll(() => status(page, place.projectId, jobId), { timeout: 20_000 })
      .toBe(`failed:${kind}`)  }
}

// One ComfyUI picture run the stand-in server reports it could not finish.
export async function failOnComfy(
  page: Page,
  stand: StandIn,
  place: Place,
  layerId: string,
): Promise<void> {
  const { jobId } = await runImages(page, place, layerId, 'comfyui')
  finishWithError(stand, await nthSentId(stand, 1))
  await expect
    .poll(() => status(page, place.projectId, jobId), { timeout: 30_000 })
    .toMatch(/^failed:/)
}

// The run in `scope` that shows `sentence` reads "Failed" and offers Retry.
export async function expectFailure(scope: Locator, sentence: string): Promise<Locator> {
  const item = scope.getByRole('listitem').filter({ hasText: sentence })
  await expect(item).toHaveCount(1)
  await expect(item.getByText('Failed', { exact: true })).toBeVisible()
  await expect(item.getByRole('button', { name: 'Retry' })).toBeEnabled()
  return item
}
