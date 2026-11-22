// R2E-6 (spec/phases/round-2-editor.md D6, "The campaign page's run list"): a done picture row
// has "Choose in the editor", a done video row "See it in the editor"; both go to the result
// through showResult and send no job.markSeen of their own.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { campaignNav, tabView } from '@/renderer/stores/nav-store'
import type { JobRow } from '@/shared/schemas/rows/job'
import { jobRow } from '../../stores/job-fixture'
import { P, campaignApi, renderWith, sent } from './campaign-fixture'

function Probe() {
  const shown = useNav((s) => campaignNav(s, P, 'C1').shown)
  const layer = useNav((s) => tabView(s, P, 'V1').selectedLayerId)
  return <output aria-label="Probe">{`${shown} ${layer ?? 'none'}`}</output>
}

async function runs(row: JobRow) {
  const fake = campaignApi({ jobs: [row] })
  await renderWith(
    <NavScope>
      <Probe />
      <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
    </NavScope>,
    fake,
  )
  return { fake, list: within(await screen.findByRole('list', { name: 'Runs' })) }
}

const probe = () => screen.getByRole('status', { name: 'Probe' })

const DONE_PICTURES = jobRow('J1', {
  status: 'succeeded',
  layerId: 'L1',
  result: { assetIds: [] },
})
const DONE_VIDEO = jobRow('J2', {
  kind: 'video_generation',
  status: 'succeeded',
  slot: null,
  result: null,
})

describe('RunRow buttons to the result [R2E-6]', () => {
  it.each<[string, JobRow, string, string]>([
    ['a done picture run', DONE_PICTURES, 'Choose in the editor', 'V1 L1'],
    ['a done video run', DONE_VIDEO, 'See it in the editor', 'V1 none'],
  ])('%s goes to its place in the editor', async (_name, row, words, place) => {
    const { fake, list } = await runs(row)
    const seenBefore = sent(fake, 'job.markSeen').length
    await userEvent.click(list.getByRole('button', { name: words }))
    await waitFor(() => expect(probe()).toHaveTextContent(place))
    expect(sent(fake, 'job.markSeen')).toHaveLength(seenBefore)
  })

  it.each<[string, JobRow]>([
    ['a running picture run', jobRow('J3', { status: 'running', layerId: 'L1' })],
    ['a failed video run', jobRow('J4', { kind: 'video_generation', status: 'failed' })],
    ['a done run with no variant', { ...DONE_PICTURES, variantId: null }],
  ])('%s has neither button', async (_name, row) => {
    const { list } = await runs(row)
    expect(list.queryByRole('button', { name: /in the editor$/ })).toBeNull()
  })
})
