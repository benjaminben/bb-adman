// spec/editor.md, "Picture chooser": a dialog titled "Choose a picture for {layer name}" with a
// grid of the asset library's pictures; a missing one is disabled with "file not found"; an empty
// library says so; "Import pictures…" picks files, imports them linked, then reads the list
// again. Choosing hands the picture back and closes; Cancel closes and hands back nothing.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PictureChooser } from '@/renderer/dialogs/picture-chooser'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { asset, type ListedAsset } from './relink-fixture'

const P = 'p1'
const PICTURES = [
  asset('a1', 'summer-hero.jpg', { missing: false }),
  asset('a2', 'lemon-splash.png', { missing: false }),
  asset('a3', 'old-logo.png'),
]

async function openChooser(list: ListedAsset[] = PICTURES) {
  const fake = makeFakeApi()
  let rows = list
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  const onChoose = vi.fn(async (_assetId: string): Promise<string | null> => null)
  const onClose = vi.fn()
  await renderApp(
    <PictureChooser
      projectId={P}
      layerName="Hero photo"
      open
      onChoose={onChoose}
      onClose={onClose}
    />,
    fake,
  )
  const dialog = screen.getByRole('dialog', { name: 'Choose a picture for Hero photo' })
  const first = list[0]
  if (first) await within(dialog).findByText(first.displayName)
  else await within(dialog).findByText('No pictures in the asset library yet.')
  return { fake, onChoose, onClose, dialog, setRows: (next: ListedAsset[]) => (rows = next) }
}

const listCalls = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)

describe('PictureChooser [spec/editor.md "Picture chooser"]', () => {
  it('lists the asset library pictures by display name, a missing one disabled', async () => {
    const { fake, dialog } = await openChooser()
    expect(listCalls(fake)).toEqual([{ projectId: P, library: 'asset', kind: 'image' }])
    const grid = within(dialog).getByRole('list', { name: 'Pictures' })
    expect(
      within(grid)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['summer-hero.jpg', 'lemon-splash.png', 'old-logo.png file not found'])
    expect(within(grid).getByRole('button', { name: 'summer-hero.jpg' })).toBeEnabled()
    expect(within(grid).getByRole('button', { name: 'old-logo.png file not found' })).toBeDisabled()
    expect(grid.querySelectorAll('img')).toHaveLength(2)
  })

  it('shows a file name as text only', async () => {
    const { dialog } = await openChooser([asset('a1', '<img src=x>.png', { missing: false })])
    expect(within(dialog).getByRole('button', { name: '<img src=x>.png' })).toBeInTheDocument()
    expect(dialog.querySelectorAll('img')).toHaveLength(1)
  })

  it('says so when the asset library has no pictures', async () => {
    const { dialog } = await openChooser([])
    expect(within(dialog).getByText('No pictures in the asset library yet.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('list', { name: 'Pictures' })).toBeNull()
  })

  it('choosing a picture hands it back and closes', async () => {
    const { onChoose, onClose, dialog } = await openChooser()
    await userEvent.click(within(dialog).getByRole('button', { name: 'lemon-splash.png' }))
    expect(onChoose.mock.calls).toEqual([['a2']])
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a refused choice shows its message and stays open', async () => {
    const { onChoose, onClose, dialog } = await openChooser()
    onChoose.mockResolvedValueOnce('That picture file is missing.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'lemon-splash.png' }))
    expect(await within(dialog).findByText('That picture file is missing.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Cancel closes and sends nothing', async () => {
    const { fake, onChoose, onClose, dialog } = await openChooser()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onChoose).not.toHaveBeenCalled()
    expect(fake.commands).toEqual([])
  })

  it('Import pictures… picks files, imports them linked, then reads the list again', async () => {
    const { fake, dialog, setRows } = await openChooser()
    fake.onQuery('dialog.pickFiles', () => ({
      ok: true,
      data: { paths: ['/Shoots/beach.jpg', '/Shoots/pool.webp'] },
    }))
    fake.onCommand('asset.import', () => {
      setRows([...PICTURES, asset('a4', 'beach.jpg', { missing: false })])
      return { ok: true, data: { assetIds: ['a4', 'a5'] } }
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import pictures…' }))
    expect(await within(dialog).findByRole('button', { name: 'beach.jpg' })).toBeInTheDocument()
    expect(fake.queries.find((q) => q.name === 'dialog.pickFiles')?.input).toEqual({
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    expect(fake.commands).toEqual([
      {
        name: 'asset.import',
        input: {
          projectId: P,
          paths: ['/Shoots/beach.jpg', '/Shoots/pool.webp'],
          library: 'asset',
          copy: false,
        },
      },
    ])
    expect(listCalls(fake)).toHaveLength(2)
  })

  it('a cancelled picker sends nothing', async () => {
    const { fake, dialog } = await openChooser()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import pictures…' }))
    await vi.waitFor(() =>
      expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true),
    )
    expect(fake.commands).toEqual([])
    expect(listCalls(fake)).toHaveLength(1)
  })

  it('a refused import shows its message', async () => {
    const { fake, dialog } = await openChooser()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Shoots/x.tiff'] } }))
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Adman cannot read that picture.' },
    }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import pictures…' }))
    expect(await within(dialog).findByText('Adman cannot read that picture.')).toBeInTheDocument()
  })

  it.each([[PICTURES], [[]]])('has no accessibility violations (%#)', async (list) => {
    await openChooser(list)
    expect(await axeViolations()).toEqual([])
  })
})
