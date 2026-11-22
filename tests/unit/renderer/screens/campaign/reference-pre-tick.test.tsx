// spec/subject-photos.md, "Subject photos as reference pictures" (SP-7, A-120): the campaign
// page ticks the chosen variant's subject photos when it opens, and again on a variant change
// while nothing is ticked; a tick the user set is kept. A pre-ticked picture is sent only
// after Generate and Confirm, with it shown ticked.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../../shared/scene/fake-fonts'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { MASTER, P, SECOND, campaignGet, renderWith, sent } from './campaign-fixture'
import { ref, referenceApi } from './reference-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />

// S1: the master's subject photo in the asset library; B1: the German post's subject photo;
// R1: a plain reference picture.
const ROWS = [
  ref('S1', { library: 'asset', subjectId: 'citrus-can' }),
  ref('B1', { subjectId: 'berry-bottle' }),
  ref('R1'),
]

function pageApi() {
  const { fake } = referenceApi(ROWS)
  const second = { ...SECOND, subjectIds: ['berry-bottle'] }
  fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet([MASTER, second]) }))
  return fake
}

const box = (name: string) => screen.getByRole('checkbox', { name })

async function toGerman() {
  await userEvent.dblClick(screen.getByRole('button', { name: /^German post/ }))
  await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
  await screen.findByText('Runs and panels below are for: German post · 1:1 · de')
}

describe('Campaign page pre-ticks subject photos [SP-7, A-120]', () => {
  it("reads every image and ticks the master's asset-library subject photo on open", async () => {
    const fake = pageApi()
    await renderWith(view, fake)
    const p = within(await screen.findByRole('region', { name: 'Reference pictures' }))
    await waitFor(() => expect(p.getByRole('checkbox', { name: 'S1.png' })).toBeChecked())
    expect(box('B1.png')).not.toBeChecked()
    expect(box('R1.png')).not.toBeChecked()
    expect(within(box('S1.png').closest('li')!).getByText('Photo of citrus-can')).toBeVisible()
    expect(fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)).toEqual([
      { projectId: P, kind: 'image' },
    ])
  })

  it('sends a pre-ticked picture only after Generate and Confirm, with it shown ticked', async () => {
    const fake = pageApi()
    await renderWith(view, fake)
    await waitFor(() => expect(box('S1.png')).toBeChecked())
    expect(sent(fake, 'generation.runImages')).toEqual([])
    const p = within(screen.getByRole('region', { name: 'Make pictures' }))
    await userEvent.click(p.getByRole('button', { name: 'Generate' }))
    expect(sent(fake, 'generation.runImages')).toEqual([])
    expect(box('S1.png')).toBeChecked()
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(
      sent(fake, 'generation.runImages').map(
        (c) => (c.input as { referenceAssetIds: string[] }).referenceAssetIds,
      ),
    ).toEqual([['S1']])
  })

  it("keeps a user's tick on a variant change", async () => {
    await renderWith(view, pageApi())
    await waitFor(() => expect(box('S1.png')).toBeChecked())
    await userEvent.click(box('S1.png'))
    await userEvent.click(box('R1.png'))
    await toGerman()
    await waitFor(() => expect(box('R1.png')).toBeChecked())
    expect(box('B1.png')).not.toBeChecked()
    expect(box('S1.png')).not.toBeChecked()
  })

  it("ticks the new variant's subject photos on a variant change when nothing is ticked", async () => {
    await renderWith(view, pageApi())
    await waitFor(() => expect(box('S1.png')).toBeChecked())
    await userEvent.click(box('S1.png'))
    await toGerman()
    await waitFor(() => expect(box('B1.png')).toBeChecked())
    expect(box('S1.png')).not.toBeChecked()
    expect(box('R1.png')).not.toBeChecked()
  })

  it('does not tick again after "Add pictures" on the same variant', async () => {
    const { fake, list } = referenceApi(ROWS)
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      list.rows = [...ROWS, ref('N1')]
      return { ok: true, data: { assetIds: ['N1'], reusedAssetIds: [], skippedCount: 0 } }
    })
    await renderWith(view, fake)
    await waitFor(() => expect(box('S1.png')).toBeChecked())
    await userEvent.click(box('S1.png'))
    await userEvent.click(screen.getByRole('button', { name: 'Add pictures' }))
    expect(await screen.findByRole('checkbox', { name: 'N1.png' })).toBeChecked()
    expect(box('S1.png')).not.toBeChecked()
  })
})
