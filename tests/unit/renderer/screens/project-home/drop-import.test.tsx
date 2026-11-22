// The drop target (spec/screens-campaign.md, "Importing by dropping files"; FR-246). A drop
// only opens the import dialog: nothing is sent before "Import".
import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropImport } from '@/renderer/screens/project-home/drop-import'
import type { DropApi } from '@/shared/schemas/drop-api'
import { makeFakeApi } from '../../fake-api'
import { renderApp, axeViolations } from '../../render'

const SUBJECTS = [
  { id: 'citrus-can', name: 'Citrus can', description: '', createdAt: '2026-11-20T00:00:00Z' },
]
const KNOWN: Record<string, string> = {
  'can-front.png': '/Users/me/Shoots/summer/can-front.png',
  'can-side.png': '/Users/me/Shoots/summer/can-side.png',
}
const standIn: DropApi = { pathOf: (file) => KNOWN[file.name] ?? '' }

// jsdom has no DataTransfer, so a plain object stands in for it.
function transfer(types: string[], names: string[] = []) {
  const files = names.map((name) => new File(['x'], name))
  const list = Object.assign(files, { item: (i: number) => files[i] ?? null })
  return { types, files: list, dropEffect: 'none' }
}

const files = (names = ['can-front.png', 'can-side.png']) => transfer(['Files'], names)
const layerText = 'Drop to import into Summer Launch'

async function page() {
  window.drop = standIn
  const fake = makeFakeApi()
  fake.onCommand('asset.import', () => ({
    ok: true,
    data: { assetIds: ['A1', 'A2'], reusedAssetIds: [], skippedCount: 0 },
  }))
  const view = await renderApp(
    <main>
      <h1>Summer Launch</h1>
      <DropImport projectId="P1" projectName="Summer Launch" subjects={SUBJECTS} />
    </main>,
    fake,
  )
  return { fake, view }
}

afterEach(() => {
  Reflect.deleteProperty(window, 'drop')
})

describe('drop target: which drags it takes [FR-246]', () => {
  it.each([
    ['files', files(), true],
    ['text', transfer(['text/plain']), false],
    ['a link', transfer(['text/uri-list', 'text/plain']), false],
  ])('a drag of %s is taken: %s', async (_kind, data, taken) => {
    await page()
    fireEvent.dragEnter(window, { dataTransfer: data })
    const notPrevented = fireEvent.dragOver(window, { dataTransfer: data })
    expect(notPrevented).toBe(!taken)
    expect(data.dropEffect).toBe(taken ? 'copy' : 'none')
    expect(screen.queryByText(layerText) !== null).toBe(taken)
  })
})

describe('drop target: the layer', () => {
  it('shows the project name while files are dragged over the window', async () => {
    await page()
    expect(screen.queryByText(layerText)).toBeNull()
    fireEvent.dragEnter(window, { dataTransfer: files() })
    expect(screen.getByText(layerText)).toBeInTheDocument()
  })

  it.each([
    ['a dragleave out of the window', () => fireEvent.dragLeave(window, { dataTransfer: files() })],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('goes on %s', async (_name, act) => {
    await page()
    fireEvent.dragEnter(window, { dataTransfer: files() })
    act()
    expect(screen.queryByText(layerText)).toBeNull()
  })

  it('stays while the drag moves from one element to another inside the window', async () => {
    await page()
    fireEvent.dragEnter(window, { dataTransfer: files() })
    fireEvent.dragEnter(window, { dataTransfer: files() })
    fireEvent.dragLeave(window, { dataTransfer: files() })
    expect(screen.getByText(layerText)).toBeInTheDocument()
  })
})

describe('drop target: dropping [FR-246]', () => {
  it('opens the import dialog with the paths, and sends nothing before "Import"', async () => {
    const { fake } = await page()
    fireEvent.dragEnter(window, { dataTransfer: files() })
    const notPrevented = fireEvent.drop(window, { dataTransfer: files() })
    expect(notPrevented).toBe(false)
    expect(screen.queryByText(layerText)).toBeNull()
    const dialog = await screen.findByRole('dialog', { name: 'Import 2 files' })
    expect(within(dialog).getByText('can-front.png')).toBeInTheDocument()
    expect(within(dialog).getByRole('option', { name: 'Citrus can (citrus-can)' })).toBeTruthy()
    expect(fake.commands).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(fake.commands).toHaveLength(1))
    expect(fake.commands[0]).toEqual({
      name: 'asset.import',
      input: { projectId: 'P1', paths: Object.values(KNOWN), library: 'asset', copy: false },
    })
  })

  it('leaves out files the bridge gives no path for', async () => {
    await page()
    fireEvent.drop(window, { dataTransfer: files(['made.png', 'can-side.png']) })
    const dialog = await screen.findByRole('dialog', { name: 'Import 1 file' })
    expect(within(dialog).getByText('can-side.png')).toBeInTheDocument()
  })

  it('does nothing for a drop whose paths are all empty', async () => {
    const { fake } = await page()
    fireEvent.dragEnter(window, { dataTransfer: files(['made.png']) })
    fireEvent.drop(window, { dataTransfer: files(['made.png']) })
    expect(screen.queryByText(layerText)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fake.commands).toEqual([])
  })

  it('ignores a drop, and shows no layer, while its import dialog is open', async () => {
    await page()
    fireEvent.drop(window, { dataTransfer: files(['can-front.png']) })
    await screen.findByRole('dialog', { name: 'Import 1 file' })
    fireEvent.dragEnter(window, { dataTransfer: files() })
    expect(screen.queryByText(layerText)).toBeNull()
    fireEvent.drop(window, { dataTransfer: files() })
    expect(screen.getByRole('dialog', { name: 'Import 1 file' })).toBeInTheDocument()
  })

  it('takes a new drop once the dialog is closed', async () => {
    await page()
    fireEvent.drop(window, { dataTransfer: files(['can-front.png']) })
    const dialog = await screen.findByRole('dialog', { name: 'Import 1 file' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.drop(window, { dataTransfer: files() })
    expect(await screen.findByRole('dialog', { name: 'Import 2 files' })).toBeInTheDocument()
  })

  it('removes its listeners on unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const types = ['dragenter', 'dragover', 'dragleave', 'drop', 'keydown']
    const { view } = await page()
    const added = add.mock.calls.filter(([type]) => types.includes(type))
    expect(added.map(([type]) => type).sort()).toEqual([...types].sort())
    view.unmount()
    for (const [type, listener] of added) {
      expect(remove).toHaveBeenCalledWith(type, listener)
    }
    add.mockRestore()
    remove.mockRestore()
  })

  it('has no axe violations with the layer shown', async () => {
    await page()
    fireEvent.dragEnter(window, { dataTransfer: files() })
    expect(await axeViolations()).toEqual([])
  })
})
