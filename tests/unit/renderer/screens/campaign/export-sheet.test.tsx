// P6-13 (spec/phases/phase-06.md, design additions 4 and 8): "Export translation sheet…" asks
// the main process's save dialog, then sends translation.exportSheet with the path that dialog
// returned (the command writes only that path, P6-7b), and shows "Saved {file name}." The
// window never draws the path or keeps it.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { MASTER, P, campaignGet } from './campaign-fixture'
import { translationRow as row, translations } from './translation-fixture'

const CHOSEN = '/Users/someone/Desktop/private-folder/sheet.csv'

function sheetApi(picked: string | null) {
  const fake = makeFakeApi()
  fake.onQuery('translation.forCampaign', () => ({ ok: true, data: translations([row('L1')]) }))
  fake.onQuery('dialog.pickSaveFile', () => ({ ok: true, data: { path: picked } }))
  fake.onCommand('translation.exportSheet', () => ({
    ok: true,
    data: { fileName: 'sheet.csv', rowCount: 1 },
  }))
  return fake
}

async function exportWith(fake: ReturnType<typeof makeFakeApi>) {
  const view = await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
    fake,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Export translation sheet…' }))
  return view
}

const sheetCommands = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'translation.exportSheet')

describe('Export translation sheet… [P6-13]', () => {
  it('asks the save dialog for the translation sheet, then sends the command it allows', async () => {
    const fake = sheetApi(CHOSEN)
    const { container } = await exportWith(fake)
    const saved = await screen.findByTitle('sheet.csv')
    expect(saved.textContent).toContain('Saved')
    expect(saved.closest('[role="status"]')).not.toBeNull()
    const picks = fake.queries.filter((q) => q.name === 'dialog.pickSaveFile')
    expect(picks).toEqual([
      { name: 'dialog.pickSaveFile', input: { purpose: 'translation-sheet' } },
    ])
    expect(sheetCommands(fake).map((c) => c.input)).toEqual([
      { projectId: P, campaignId: 'C1', filePath: CHOSEN },
    ])
    expect(container.innerHTML).not.toContain('private-folder')
    expect(container.innerHTML).not.toContain('/Users/')
  })

  it('a cancelled save dialog sends nothing and shows nothing', async () => {
    const fake = sheetApi(null)
    await exportWith(fake)
    await screen.findByRole('button', { name: 'Export translation sheet…' })
    expect(sheetCommands(fake)).toEqual([])
    expect(screen.queryByText(/^Saved/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("shows a refusal's own message, without the path", async () => {
    const fake = sheetApi(CHOSEN)
    fake.onCommand('translation.exportSheet', () => ({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: "Choose a folder outside the project's assets folder.",
      },
    }))
    const { container } = await exportWith(fake)
    expect(
      await screen.findByText("Choose a folder outside the project's assets folder."),
    ).toBeVisible()
    expect(screen.queryByText(/^Saved/)).toBeNull()
    expect(container.innerHTML).not.toContain('private-folder')
  })
})
