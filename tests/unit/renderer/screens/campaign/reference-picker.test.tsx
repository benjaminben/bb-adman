// SPEC 14 1.46 TP-5 "The picker" and "Adding": the project's reference pictures under the
// prompt box, and "Add pictures" through the system picker and asset.import.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { axeViolations } from '../../render'
import { P, renderWith, sent } from './campaign-fixture'
import { ref, referenceApi } from './reference-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />

async function picker() {
  return within(await screen.findByRole('region', { name: 'Reference pictures' }))
}

describe('ReferencePicker [SPEC 14 1.46 TP-5]', () => {
  it('reads asset.list for the reference pictures of the project', async () => {
    const { fake } = referenceApi([])
    await renderWith(view, fake)
    await picker()
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)).toEqual([
        { projectId: P, kind: 'image' },
      ]),
    )
  })

  it('draws one picture per asset with the address from assetUrl, and no path', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    const { container } = await renderWith(view, fake)
    const p = await picker()
    await p.findByRole('checkbox', { name: 'A1.png' })
    const images = within(container.querySelector('[aria-label="Reference pictures"]')!)
      .getAllByRole('presentation')
      .map((img) => img.getAttribute('src'))
    expect(images).toEqual([`adman-asset://${P}/A1`, `adman-asset://${P}/A2`])
    expect(container.innerHTML).not.toContain('/Users/me/Pictures')
    expect(await axeViolations()).toEqual([])
  })

  it('shows the sentence and the button for an empty list', async () => {
    const { fake } = referenceApi([])
    await renderWith(view, fake)
    const p = await picker()
    expect(await p.findByText('No reference pictures in this project yet.')).toBeInTheDocument()
    expect(p.getByRole('button', { name: 'Add pictures' })).toBeInTheDocument()
  })

  it('draws a display name holding <b> as its characters', async () => {
    const { fake } = referenceApi([ref('A1', { displayName: '<b>bold</b>.png' })])
    const { container } = await renderWith(view, fake)
    const p = await picker()
    expect(await p.findByText('<b>bold</b>.png')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="Reference pictures"] b')).toBeNull()
  })

  it('asks the system picker for images to import on "Add pictures"', async () => {
    const { fake } = referenceApi([])
    await renderWith(view, fake)
    await userEvent.click((await picker()).getByRole('button', { name: 'Add pictures' }))
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'dialog.pickFiles').map((q) => q.input)).toEqual(
        [{ purpose: 'import', kind: 'image', multiple: true }],
      ),
    )
  })

  it("sends the picked paths to asset.import as references, linked, with the variant's subject", async () => {
    const { fake } = referenceApi([])
    fake.onQuery('dialog.pickFiles', () => ({
      ok: true,
      data: { paths: ['/Users/me/a.png', '/Users/me/b.jpg'] },
    }))
    await renderWith(view, fake)
    await userEvent.click((await picker()).getByRole('button', { name: 'Add pictures' }))
    await waitFor(() =>
      expect(sent(fake, 'asset.import').map((c) => c.input)).toEqual([
        {
          projectId: P,
          paths: ['/Users/me/a.png', '/Users/me/b.jpg'],
          library: 'reference',
          copy: false,
          subjectId: 'citrus-can',
        },
      ]),
    )
  })

  it('sends nothing when the picker is cancelled', async () => {
    const { fake } = referenceApi([])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await renderWith(view, fake)
    await userEvent.click((await picker()).getByRole('button', { name: 'Add pictures' }))
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true))
    expect(sent(fake, 'asset.import')).toEqual([])
    expect(fake.commands).toEqual([])
  })

  it('reads the list again after an import and ticks the new assets', async () => {
    const { fake, list } = referenceApi([ref('A1')])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      list.rows = [ref('A1'), ref('N1')]
      return { ok: true, data: { assetIds: ['N1'], reusedAssetIds: [], skippedCount: 0 } }
    })
    await renderWith(view, fake)
    const p = await picker()
    await p.findByRole('checkbox', { name: 'A1.png' })
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
    expect(await p.findByRole('checkbox', { name: 'N1.png' })).toBeChecked()
    expect(p.getByRole('checkbox', { name: 'A1.png' })).not.toBeChecked()
    expect(fake.queries.filter((q) => q.name === 'asset.list')).toHaveLength(2)
  })

  it("shows a refused asset.import's message and ticks nothing", async () => {
    const { fake } = referenceApi([ref('A1')])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'n.png could not be read.' },
    }))
    await renderWith(
      <>
        <ErrorBanner />
        {view}
      </>,
      fake,
    )
    const p = await picker()
    await p.findByRole('checkbox', { name: 'A1.png' })
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('n.png could not be read.')
    expect(p.getByRole('checkbox', { name: 'A1.png' })).not.toBeChecked()
  })
})
