// "Import files…" and "Import a folder…" (spec/screens-campaign.md, "Import buttons").
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'

const SUBJECTS = [
  { id: 'citrus-can', name: 'Citrus can', description: '', createdAt: '2026-11-20T00:00:00Z' },
]

async function page() {
  const fake = makeFakeApi()
  fake.onQuery('dialog.pickFiles', () => ({
    ok: true,
    data: { paths: ['/shoot/can-front.png', '/shoot/can-side.png'] },
  }))
  fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: '/shoot/Summer pack' } }))
  fake.onCommand('asset.import', () => ({
    ok: true,
    data: { assetIds: ['A1'], reusedAssetIds: [], skippedCount: 0 },
  }))
  await renderApp(<ImportFiles projectId="P1" subjects={SUBJECTS} />, fake)
  return fake
}

describe('import buttons [spec/screens-campaign.md, Import buttons]', () => {
  it.each([
    [
      'Import files…',
      { name: 'dialog.pickFiles', input: { purpose: 'import', multiple: true } },
      'Import 2 file(s)',
      ['/shoot/can-front.png', '/shoot/can-side.png'],
    ],
    [
      'Import a folder…',
      { name: 'dialog.pickFolder', input: { title: 'Choose a folder to import' } },
      'Import a folder',
      ['/shoot/Summer pack'],
    ],
  ])(
    '"%s" opens its picker, then the dialog with the picked paths',
    async (button, query, title, paths) => {
      const fake = await page()
      await userEvent.click(screen.getByRole('button', { name: button }))
      const dialog = await screen.findByRole('dialog', { name: title })
      expect(fake.queries).toContainEqual(query)
      expect(fake.commands).toEqual([])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))
      await waitFor(() => expect(fake.commands).toHaveLength(1))
      expect(fake.commands[0]).toEqual({
        name: 'asset.import',
        input: { projectId: 'P1', paths, library: 'asset', copy: false },
      })
    },
  )

  it.each([
    ['Import files…', 'dialog.pickFiles', { paths: [] }],
    ['Import a folder…', 'dialog.pickFolder', { path: null }],
  ])(
    'a cancelled picker behind "%s" sends nothing and opens nothing',
    async (button, name, data) => {
      const fake = await page()
      fake.onQuery(name, () => ({ ok: true, data }))
      await userEvent.click(screen.getByRole('button', { name: button }))
      await waitFor(() => expect(fake.queries.map((q) => q.name)).toContain(name))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fake.commands).toEqual([])
    },
  )
})
