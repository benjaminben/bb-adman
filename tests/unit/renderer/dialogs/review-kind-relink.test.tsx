// DLG-7 (spec/phases/design-wave-screens-b.md, "DLG-7 — Review dialogs"): the relink dialog
// uses kind="review". Each missing file is a row with an alert mark and "Find…"; a file found
// moves to a "Found" list with a check mark. The box is a Switch "Search folder" that keeps its
// old name, with an InfoTip. Result sentences use real plurals and stay on the page. Files are
// named by their display names; no stored path is drawn.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { asset, serveAssets } from './relink-fixture'

const ROWS = [
  asset('a1', 'harbour-dawn.png'),
  asset('a2', 'pebble-logo.png'),
  asset('a3', 'tide-clip.mp4', { kind: 'video' }),
]
const SWITCH = 'Also look for other missing files in the same folder'

async function openDialog(siblingIds: string[] = []) {
  const fake = makeFakeApi()
  const served = serveAssets(fake, ROWS)
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Volumes/Card/x.png'] } }))
  fake.onCommand('asset.relink', (input) => {
    const { assetId } = input as { assetId: string }
    served.found([assetId, ...siblingIds])
    return { ok: true, data: { assetId, siblingIds } }
  })
  await renderApp(<RelinkDialog projectId="p1" open onClose={() => {}} />, fake)
  await screen.findByRole('list', { name: 'Missing files' })
  return fake
}

describe('the relink dialog as a review dialog [DLG-7]', () => {
  it('draws the box as a Switch "Search folder" with its old name and an InfoTip', async () => {
    await openDialog()
    const toggle = screen.getByRole('switch', { name: SWITCH })
    expect(toggle).toBeChecked()
    expect(toggle).toHaveFocus()
    expect(screen.getByText('Search folder')).toBeVisible()
    expect(screen.getByRole('button', { name: 'About Search folder' })).toBeVisible()
  })

  it('marks each missing row and moves a found file to "Found" with a check', async () => {
    await openDialog(['a2'])
    const missing = screen.getByRole('list', { name: 'Missing files' })
    expect(within(missing).getAllByTitle('Missing')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Find harbour-dawn.png' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Found harbour-dawn.png. 1 other file in the same folder was found too.',
    )
    const found = screen.getByRole('list', { name: 'Found' })
    const names = within(found)
      .getAllByRole('listitem')
      .map((li) => li.firstElementChild?.getAttribute('title'))
    expect(names).toEqual(['Found', 'Found'])
    expect(found).toHaveTextContent('harbour-dawn.png')
    expect(found).toHaveTextContent('pebble-logo.png')
    expect(within(found).queryByRole('button')).toBeNull()
    expect(within(missing).getAllByRole('listitem')).toHaveLength(1)
    expect(await axeViolations()).toEqual([])
  })

  it('says how many other files were found with a real plural', async () => {
    await openDialog(['a2', 'a3'])
    await userEvent.click(screen.getByRole('button', { name: 'Find harbour-dawn.png' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Found harbour-dawn.png. 2 other files in the same folder were found too.',
    )
  })

  it('draws no stored path anywhere in the dialog', async () => {
    await openDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Find harbour-dawn.png' }))
    await screen.findByRole('status')
    for (const part of ['/Users/me', 'Shoots', '/Volumes/Card'])
      expect(document.body.innerHTML).not.toContain(part)
  })
})
