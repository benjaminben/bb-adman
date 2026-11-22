import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { asset, serveAssets, type ListedAsset } from './relink-fixture'

const rows: ListedAsset[] = [
  asset('a3', 'summer-banner.mp4', { kind: 'video', library: 'reference' }),
  asset('a1', 'hero-shot.png'),
  asset('a2', 'found-logo.svg', { missing: false }),
  asset('a4', 'Brand Sans.otf', { kind: 'font' }),
  asset('a5', 'tagline.txt', { kind: 'text' }),
]

async function openDialog(onlyAssetIds?: string[], list = rows) {
  const fake = makeFakeApi()
  const served = serveAssets(fake, list)
  fake.onQuery('dialog.pickFiles', () => ({
    ok: true,
    data: { paths: ['/Volumes/Shoots/new.png'] },
  }))
  const view = await renderApp(
    <RelinkDialog projectId="p1" open onClose={() => {}} onlyAssetIds={onlyAssetIds} />,
    fake,
  )
  const list_ = await screen.findByRole('list', { name: 'Missing files' })
  return { ...view, fake, served, list: list_ }
}

function rowNames(list: HTMLElement) {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

function relinkReply(fake: ReturnType<typeof makeFakeApi>, served: { found(ids: string[]): void }) {
  return (siblingIds: string[]) =>
    fake.onCommand('asset.relink', (input) => {
      const { assetId } = input as { assetId: string }
      served.found([assetId, ...siblingIds])
      return { ok: true, data: { assetId, siblingIds } }
    })
}

describe('the relink dialog [spec/screens-campaign.md, relink dialog; FR-009]', () => {
  it('lists only the missing assets, by name, with kind and library', async () => {
    const { list, fake } = await openDialog()
    expect(rowNames(list)).toEqual([
      'Brand Sans.otf font, asset library Find…',
      'hero-shot.png picture, asset library Find…',
      'summer-banner.mp4 video, reference library Find…',
      'tagline.txt text file, asset library Find…',
    ])
    expect(fake.queries).toContainEqual({ name: 'asset.list', input: { projectId: 'p1' } })
    expect(screen.getByRole('button', { name: 'Find hero-shot.png' })).toBeInTheDocument()
  })

  it('narrows the list to onlyAssetIds', async () => {
    const { list } = await openDialog(['a1', 'a2', 'a5'])
    expect(rowNames(list)).toEqual([
      'hero-shot.png picture, asset library Find…',
      'tagline.txt text file, asset library Find…',
    ])
  })

  it('has the box ticked and focused on open', async () => {
    await openDialog()
    const box = screen.getByRole('switch', {
      name: 'Also look for other missing files in the same folder',
    })
    expect(box).toBeChecked()
    expect(box).toHaveFocus()
  })

  it.each([
    [true, [], 'Found summer-banner.mp4.'],
    [
      false,
      ['a1', 'a5'],
      'Found summer-banner.mp4. 2 other files in the same folder were found too.',
    ],
  ])(
    'with the box %s sends the picker for the kind, then asset.relink, and says what was found',
    async (keepTicked, siblingIds, sentence) => {
      const { fake, served } = await openDialog()
      relinkReply(fake, served)(siblingIds)
      if (!keepTicked) await userEvent.click(screen.getByRole('switch'))
      await userEvent.click(screen.getByRole('button', { name: 'Find summer-banner.mp4' }))

      expect(await screen.findByRole('status')).toHaveTextContent(sentence)
      expect(fake.queries).toContainEqual({
        name: 'dialog.pickFiles',
        input: { purpose: 'relink', kind: 'video' },
      })
      expect(fake.commands).toContainEqual({
        name: 'asset.relink',
        input: {
          projectId: 'p1',
          assetId: 'a3',
          newPath: '/Volumes/Shoots/new.png',
          relinkSiblings: keepTicked,
        },
      })
      const names = rowNames(screen.getByRole('list', { name: 'Missing files' }))
      expect(names.some((n) => n?.startsWith('summer-banner.mp4'))).toBe(false)
      expect(names).toHaveLength(3 - siblingIds.length)
    },
  )

  it('sends nothing when the picker is cancelled', async () => {
    const { fake } = await openDialog()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: null }))
    await userEvent.click(screen.getByRole('button', { name: 'Find hero-shot.png' }))
    expect(fake.commands.filter((c) => c.name === 'asset.relink')).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a refusal inside the dialog and reads the list again', async () => {
    const { fake } = await openDialog()
    fake.onCommand('asset.relink', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'Choose a file of the same kind: image.' },
    }))
    const before = fake.queries.filter((q) => q.name === 'asset.list').length
    await userEvent.click(screen.getByRole('button', { name: 'Find hero-shot.png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a file of the same kind: image.',
    )
    expect(fake.queries.filter((q) => q.name === 'asset.list').length).toBe(before + 1)
    expect(screen.getByRole('button', { name: 'Find hero-shot.png' })).toBeEnabled()
  })

  it('reads "Finding…" and keeps every button disabled while a relink waits', async () => {
    const { fake } = await openDialog()
    let answer: (r: Result<unknown>) => void = () => {}
    fake.onCommand('asset.relink', () => new Promise((resolve) => (answer = resolve)))
    await userEvent.click(screen.getByRole('button', { name: 'Find hero-shot.png' }))
    const finding = await screen.findByRole('button', { name: 'Find hero-shot.png' })
    expect(finding).toHaveTextContent('Finding…')
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    answer({ ok: true, data: { assetId: 'a1', siblingIds: [] } })
    expect(await screen.findByRole('status')).toHaveTextContent('Found hero-shot.png.')
  })

  it('moves focus to the next Find button, then to Close when the list is empty', async () => {
    const two = [asset('a1', 'hero-shot.png'), asset('a2', 'logo.png')]
    const { fake, served } = await openDialog(undefined, two)
    relinkReply(fake, served)([])
    await userEvent.click(screen.getByRole('button', { name: 'Find hero-shot.png' }))
    await screen.findByRole('status')
    expect(screen.getByRole('button', { name: 'Find logo.png' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Find logo.png' }))
    expect(await screen.findByText('No file is missing.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('shows the loading line before the list arrives', async () => {
    const fake = makeFakeApi()
    fake.onQuery('asset.list', () => new Promise(() => {}))
    await renderApp(<RelinkDialog projectId="p1" open onClose={() => {}} />, fake)
    expect(screen.getByText('Looking for missing files…')).toBeInTheDocument()
  })

  it('passes axe with a list', async () => {
    await openDialog()
    expect(await axeViolations()).toEqual([])
  })
})
