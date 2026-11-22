// SPEC 14 1.48 TL-2 "one run per click" for Retry in Earlier options (spec/screens-ai.md,
// "Earlier options"; design wave CAMP-7): from the click until the reply, Retry (a local run)
// or the run dialog's Retry (a paid run) is disabled, so a double click sends one job.retry.
// A paid retry shows its cost in the dialog at that click. Holds the cases of the campaign
// page's run-row-click test.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import type { Result } from '@/shared/schemas/result'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { baseState } from '../fake-api'
import { renderApp } from '../render'
import { LOCAL, campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { REFUSED, heldReply } from '../screens/campaign/held-reply'
import { jobRow } from '../stores/job-fixture'
import { LOGO, P } from './editor-fixture'

const LAYER: LayerRow = { ...LOGO, source: { assetId: 'A2' } }
const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J9' } }
const REPLIES = [
  ['a start', STARTED],
  ['a refusal', REFUSED],
] as const

async function open(provider: string) {
  const fake = campaignApi({ state: { providers: [...baseState().providers, LOCAL] } })
  const job = jobRow('J1', {
    status: 'failed',
    provider,
    layerId: LAYER.id,
    slot: null,
    request: { prompt: 'A can', referenceAssetIds: [], count: 4, width: 200, height: 120 },
    result: { assetIds: ['A1'] },
  })
  fake.onQuery('job.earlierOptions', () => ({ ok: true, data: [{ job, assets: [] }] }))
  const held = heldReply()
  fake.onCommand('job.retry', held.answer)
  await renderApp(
    <main>
      <EarlierOptions projectId={P} layer={LAYER} />
    </main>,
    fake,
  )
  return { fake, held, retry: await screen.findByRole('button', { name: 'Retry' }) }
}

describe('Earlier options Retry, one retry per click [TL-2]', () => {
  for (const [name, reply] of REPLIES) {
    it(`sends one job.retry for two clicks on Retry of a local run, enabled again on ${name}`, async () => {
      const { fake, held, retry } = await open('fake')
      await userEvent.dblClick(retry)
      expect(sent(fake, 'job.retry')).toHaveLength(1)
      expect(retry).toBeDisabled()
      held.release(reply)
      await waitFor(() => expect(retry).toBeEnabled())
      expect(sent(fake, 'job.retry')).toHaveLength(1)
    })

    it(`sends one job.retry for two clicks on the dialog's Retry of a paid run, until ${name}`, async () => {
      const { fake, held, retry } = await open('gemini')
      await userEvent.click(retry)
      const dialog = within(await screen.findByRole('dialog', { name: 'Retry the run' }))
      expect(dialog.getByText('This will use 3 generation(s) with Google Gemini.')).toBeVisible()
      expect(sent(fake, 'job.retry')).toEqual([])
      const confirm = dialog.getByRole('button', { name: 'Retry' })
      await userEvent.dblClick(confirm)
      expect(sent(fake, 'job.retry')).toHaveLength(1)
      expect(confirm).toBeDisabled()
      held.release(reply)
      if (reply.ok) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      else await waitFor(() => expect(confirm).toBeEnabled())
      expect(sent(fake, 'job.retry')).toHaveLength(1)
    })
  }
})
