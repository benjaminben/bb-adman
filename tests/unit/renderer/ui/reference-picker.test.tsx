// ui/reference-picker/ (SPEC 14 1.46 TP-5 "The picker" and "Adding"; F-8 [A-56]), drawn on its
// own now that the campaign page's "Make pictures" panel is gone (design wave CAMP-7); the
// editor's reference dialog draws it. The cases of the campaign page's reference-picker test,
// word for word, with the picker in place of the page; and from reference-ticks and
// reference-limit, the cases about the picker itself.
import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { ReferencePicker } from '@/renderer/ui/reference-picker'
import { axeViolations, renderApp } from '../render'
import { P, sent } from '../screens/campaign/campaign-fixture'
import { ref, referenceApi } from '../screens/campaign/reference-fixture'

function Harness() {
  const [ticks, setTicks] = useState<string[]>([])
  return (
    <main>
      <ErrorBanner />
      <ReferencePicker
        projectId={P}
        subjectId="citrus-can"
        local={false}
        ticks={ticks}
        setTicks={setTicks}
      />
    </main>
  )
}

async function draw(fake: ReturnType<typeof referenceApi>['fake']) {
  const view = await renderApp(<Harness />, fake)
  return { ...view, p: within(await screen.findByRole('region', { name: 'Reference pictures' })) }
}

describe('ReferencePicker [SPEC 14 1.46 TP-5]', () => {
  it('reads asset.list for the reference pictures of the project', async () => {
    const { fake } = referenceApi([])
    await draw(fake)
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)).toEqual([
        { projectId: P, kind: 'image' },
      ]),
    )
  })

  it('draws one picture per asset with the address from assetUrl, and no path', async () => {
    const { fake } = referenceApi([ref('A1'), ref('A2')])
    const { container, p } = await draw(fake)
    await p.findByRole('checkbox', { name: 'A1.png' })
    const images = within(container.querySelector('[aria-label="Reference pictures"]')!)
      .getAllByRole('presentation')
      .map((img) => img.getAttribute('src'))
    expect(images).toEqual([`adman-asset://${P}/A1`, `adman-asset://${P}/A2`])
    expect(container.innerHTML).not.toContain('/Users/me/Pictures')
    expect(await axeViolations()).toEqual([])
  })

  it('shows the sentence and the button for an empty list', async () => {
    const { p } = await draw(referenceApi([]).fake)
    expect(await p.findByText('No reference pictures in this project yet.')).toBeInTheDocument()
    expect(p.getByRole('button', { name: 'Add pictures' })).toBeInTheDocument()
  })

  it('draws a display name holding <b> as its characters', async () => {
    const { container, p } = await draw(
      referenceApi([ref('A1', { displayName: '<b>bold</b>.png' })]).fake,
    )
    expect(await p.findByText('<b>bold</b>.png')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="Reference pictures"] b')).toBeNull()
  })

  it('asks the system picker for images to import on "Add pictures"', async () => {
    const { fake } = referenceApi([])
    const { p } = await draw(fake)
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
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
    const { p } = await draw(fake)
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
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
    const { p } = await draw(fake)
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true))
    expect(fake.commands).toEqual([])
  })

  it('reads the list again after an import and ticks the new assets', async () => {
    const { fake, list } = referenceApi([ref('A1')])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      list.rows = [ref('A1'), ref('N1')]
      return { ok: true, data: { assetIds: ['N1'], reusedAssetIds: [], skippedCount: 0 } }
    })
    const { p } = await draw(fake)
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
    const { p } = await draw(fake)
    await p.findByRole('checkbox', { name: 'A1.png' })
    await userEvent.click(p.getByRole('button', { name: 'Add pictures' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('n.png could not be read.')
    expect(p.getByRole('checkbox', { name: 'A1.png' })).not.toBeChecked()
  })
})

describe('ReferencePicker ticks [SPEC 14 1.46 TP-5; F-8, A-56]', () => {
  it('cannot tick a missing asset, and says why; a WebP asset is offered like a PNG', async () => {
    const { p } = await draw(
      referenceApi([
        ref('M1', { missing: true }),
        ref('W1', { mime: 'image/webp', displayName: 'W1.webp' }),
      ]).fake,
    )
    const missing = await p.findByRole('checkbox', { name: 'M1.png' })
    const webp = p.getByRole('checkbox', { name: 'W1.webp' })
    expect(missing).toBeDisabled()
    expect(webp).toBeEnabled()
    expect(missing).toHaveAccessibleDescription('file not found')
    expect(webp).toHaveAccessibleDescription('')
  })

  it('stops a ninth tick at 8 pictures and says why; unticking one frees it', async () => {
    const line = 'A run takes at most 8 reference pictures.'
    const names = Array.from({ length: 9 }, (_, i) => `R${i + 1}`)
    const { p } = await draw(referenceApi(names.map((id) => ref(id))).fake)
    await p.findByRole('checkbox', { name: 'R9.png' })
    expect(p.queryByText(line)).toBeNull()
    for (const id of names.slice(0, 8))
      await userEvent.click(p.getByRole('checkbox', { name: `${id}.png` }))
    const ninth = p.getByRole('checkbox', { name: 'R9.png' })
    expect(ninth).toBeDisabled()
    expect(ninth).not.toBeChecked()
    expect(p.getByText(line)).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
    await userEvent.click(p.getByRole('checkbox', { name: 'R8.png' }))
    expect(ninth).toBeEnabled()
    expect(p.queryByText(line)).toBeNull()
  })
})
