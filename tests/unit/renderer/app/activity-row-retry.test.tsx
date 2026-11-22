// Retry from an activity row (spec/screens-ai.md, "The activity panel"; design wave CAMP-7):
// the rules the campaign page's run rows held, on the path that remains. SPEC 14 1.48 TL-2
// "one run per click": from the click until the reply a second click sends nothing, for a
// local run, a paid picture run (the run dialog) and a paid video run (the one-line paid
// confirm). S2-5, FN-4: the paid count is what job.retry will ask for, and a ComfyUI run asks
// for no confirm. Holds the cases of run-row-click and run-row-retry-count.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActivityRow } from '@/renderer/app/activity-row'
import type { Result } from '@/shared/schemas/result'
import type { JobRow } from '@/shared/schemas/rows/job'
import { baseState, makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { LOCAL } from '../screens/campaign/campaign-fixture'
import { REFUSED, heldReply } from '../screens/campaign/held-reply'
import { costLine } from '../cost-line'
import { COMFY, videoRow } from '../screens/campaign/video-fixture'
import { jobRow } from '../stores/job-fixture'

const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }
const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J2' } }
const REPLIES = [
  ['a start', STARTED],
  ['a refusal', REFUSED],
] as const
const KEPT = {
  assetIds: ['01JD000000000000000000AS01', '01JD000000000000000000AS02'],
  failures: {},
}
const REQUEST = { prompt: 'A can', referenceAssetIds: [], count: 4, width: 1080, height: 1080 }

async function draw(job: JobRow) {
  const fake = makeFakeApi(baseState({ providers: [...baseState().providers, LOCAL, COMFY] }))
  const held = heldReply()
  fake.onCommand('job.retry', held.answer)
  await renderApp(
    <main>
      <ul aria-label="Jobs">
        <ActivityRow entry={{ job, place: PLACE }} projectId="P1" onGo={() => {}} />
      </ul>
    </main>,
    fake,
  )
  const row = within(screen.getByRole('listitem'))
  const retries = () => fake.commands.filter((c) => c.name === 'job.retry')
  return { fake, held, row, retries }
}

describe('ActivityRow Retry, one retry per click [TL-2]', () => {
  for (const [name, reply] of REPLIES) {
    it(`sends one job.retry for two clicks on Retry of a local run, enabled again on ${name}`, async () => {
      const { held, row, retries } = await draw(
        jobRow('J1', { status: 'cancelled', provider: 'fake' }),
      )
      const retry = row.getByRole('button', { name: 'Retry' })
      await userEvent.dblClick(retry)
      expect(retries()).toHaveLength(1)
      expect(retry).toBeDisabled()
      held.release(reply)
      await waitFor(() => expect(retry).toBeEnabled())
      expect(retries()).toHaveLength(1)
    })

    it(`sends one job.retry for two clicks on the dialog's Retry of a paid picture run, until ${name}`, async () => {
      const { held, row, retries } = await draw(jobRow('J1', { status: 'failed' }))
      await userEvent.click(row.getByRole('button', { name: 'Retry' }))
      const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
      expect(dialog.getByText(costLine('Paid: 2 pictures → Google Gemini'))).toBeVisible()
      expect(retries()).toEqual([])
      const confirm = dialog.getByRole('button', { name: 'Retry' })
      await userEvent.dblClick(confirm)
      expect(retries()).toHaveLength(1)
      expect(confirm).toBeDisabled()
      held.release(reply)
      if (reply.ok) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      else await waitFor(() => expect(confirm).toBeEnabled())
      expect(retries()).toHaveLength(1)
    })

    it(`sends one job.retry for two clicks on Confirm of a paid video run, enabled again on ${name}`, async () => {
      const job = videoRow({ status: 'failed', provider: 'gemini' })
      const { held, row, retries } = await draw(job)
      await userEvent.click(row.getByRole('button', { name: 'Retry' }))
      expect(retries()).toEqual([])
      await userEvent.dblClick(row.getByRole('button', { name: 'Confirm' }))
      expect(retries()).toHaveLength(1)
      const retry = row.getByRole('button', { name: 'Retry' })
      expect(retry).toBeDisabled()
      await userEvent.click(retry)
      expect(row.queryByText(/^Paid:/)).toBeNull()
      held.release(reply)
      await waitFor(() => expect(retry).toBeEnabled())
      expect(retries()).toHaveLength(1)
    })
  }
})

describe('ActivityRow, the confirm count on Retry [FN-4]', () => {
  it('a cancelled picture row with two kept pictures asks for the rest', async () => {
    const { row } = await draw(
      jobRow('J1', { status: 'cancelled', request: REQUEST, result: KEPT }),
    )
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
    expect(dialog.getByText('Pictures: 2')).toBeVisible()
    expect(dialog.getByText(costLine('Paid: 2 pictures → Google Gemini'))).toBeVisible()
  })

  it('names the references a retried picture run sends again', async () => {
    const request = { ...(REQUEST as object), referenceAssetIds: ['A1', 'A2', 'A3'] }
    const { row } = await draw(jobRow('J1', { status: 'failed', request, result: KEPT }))
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
    expect(
      dialog.getByText(costLine('Paid: 2 pictures + 3 references → Google Gemini')),
    ).toBeVisible()
  })

  it('a video row counts one request', async () => {
    // A video retry is one paid submit, whatever its stored request says.
    const job = videoRow({
      status: 'failed',
      provider: 'gemini',
      request: { ...(videoRow().request as object), count: 4 },
      result: KEPT,
    })
    const { row } = await draw(job)
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    expect(row.getByText(costLine('Paid: 1 request → Google Gemini'))).toBeInTheDocument()
  })

  it('sends job.retry for a failed ComfyUI row with no confirm line', async () => {
    const job = jobRow('J1', { status: 'failed', provider: 'comfyui', errorReason: 'run_failed' })
    const { row, retries } = await draw(job)
    await userEvent.click(row.getByRole('button', { name: 'Retry' }))
    expect(row.queryByText(/^Paid:/)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(retries().map((c) => c.input)).toEqual([{ projectId: 'P1', jobId: 'J1' }])
  })
})
