// dialog.pickSaveFile (Phase 6 section 1, P6-8) through the real window bridge. The native
// save dialog cannot be clicked, so the main process's dialog.showSaveDialog is replaced by a
// stub that keeps the options it was given and answers as the user would.
import { test, expect, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

async function answerSaveDialog(app: ElectronApplication, filePath: string | null): Promise<void> {
  await app.evaluate(({ dialog }, given) => {
    const seen = globalThis as unknown as { savePickerOptions?: unknown[] }
    seen.savePickerOptions = []
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      seen.savePickerOptions?.push(args.at(-1))
      return { canceled: given === null, filePath: given ?? '' }
    }) as unknown as typeof dialog.showSaveDialog
  }, filePath)
}

test('the save picker offers .csv and returns the chosen path, or null when cancelled', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  const chosen = path.join(box.root, 'sheet.csv')
  const suggested = path.join(box.root, 'not-made', 'suggested.csv')
  const ask = () =>
    page.evaluate(
      (defaultPath) =>
        (
          window as unknown as {
            api: { query: (n: string, i: unknown) => Promise<unknown> }
          }
        ).api.query('dialog.pickSaveFile', { purpose: 'translation-sheet', defaultPath }),
      suggested,
    )

  await answerSaveDialog(app, chosen)
  expect(await ask()).toEqual({ ok: true, data: { path: chosen } })
  const options = await app.evaluate(
    () => (globalThis as unknown as { savePickerOptions: unknown[] }).savePickerOptions,
  )
  expect(options).toEqual([
    { defaultPath: suggested, filters: [{ name: 'Translation sheet', extensions: ['csv'] }] },
  ])
  expect(fs.existsSync(path.dirname(suggested))).toBe(false)

  await answerSaveDialog(app, null)
  expect(await ask()).toEqual({ ok: true, data: { path: null } })
  await app.close()
})
