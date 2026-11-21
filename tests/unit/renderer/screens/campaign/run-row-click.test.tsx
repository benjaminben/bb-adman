// SPEC 14 1.48 TL-2 "one run per click": from the moment job.retry is sent until its reply
// arrives, Retry is disabled, for every provider. A paid retry still asks first.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '../../../../../src/renderer/screens/campaign/campaign-view'
import type { Result } from '../../../../../src/shared/schemas/result'
import type { JobRow } from '../../../../../src/shared/schemas/rows/job'
import { baseState } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { LOCAL, P, campaignApi, renderWith, sent } from './campaign-fixture'
import { REFUSED, heldReply } from './held-reply'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J2' } }

async function runs(row: JobRow, local: boolean) {
  const state = local ? { providers: [LOCAL, ...baseState().providers] } : {}
  const fake = campaignApi({ jobs: [row], state })
  const held = heldReply()
  fake.onCommand('job.retry', held.answer)
  await renderWith(view, fake)
  return { fake, held, list: within(await screen.findByRole('list', { name: 'Runs' })) }
}

describe('RunRow, one retry per click [SPEC 14 1.48 TL-2]', () => {
  for (const [name, reply] of [
    ['a start', STARTED],
    ['a refusal', REFUSED],
  ] as const) {
    it(`sends one job.retry for two clicks on Retry of a local run, enabled again on ${name}`, async () => {
      const row = jobRow('J1', { status: 'cancelled', provider: 'fake' })
      const { fake, held, list } = await runs(row, true)
      const retry = list.getByRole('button', { name: 'Retry' })
      await userEvent.dblClick(retry)
      expect(sent(fake, 'job.retry')).toHaveLength(1)
      expect(retry).toBeDisabled()
      held.release(reply)
      await waitFor(() => expect(retry).toBeEnabled())
      expect(sent(fake, 'job.retry')).toHaveLength(1)
    })

    it(`sends one job.retry for two clicks on Confirm of a paid run, enabled again on ${name}`, async () => {
      const { fake, held, list } = await runs(jobRow('J1', { status: 'failed' }), false)
      await userEvent.click(list.getByRole('button', { name: 'Retry' }))
      expect(sent(fake, 'job.retry')).toEqual([])
      await userEvent.dblClick(list.getByRole('button', { name: 'Confirm' }))
      expect(sent(fake, 'job.retry')).toHaveLength(1)
      const retry = list.getByRole('button', { name: 'Retry' })
      expect(retry).toBeDisabled()
      await userEvent.click(retry)
      expect(list.queryByText(/paid request/)).toBeNull()
      held.release(reply)
      await waitFor(() => expect(retry).toBeEnabled())
      expect(sent(fake, 'job.retry')).toHaveLength(1)
    })
  }
})
