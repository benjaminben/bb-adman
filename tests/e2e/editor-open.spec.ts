// P3-9 "Check first" (spec/editor.md, "Keyboard shortcuts", the app menu): Mod+Z pressed with
// the canvas focused reaches the page and undoes the variant's last change, and, because the
// editor calls preventDefault, the Edit menu's Undo does not also act. Mod+= zooms the canvas,
// never the page. Each check has a control: the same key outside the editor.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

async function openEditor(): Promise<Page> {
  app = await launch(box)
  const page = await app.firstWindow()
  await screens.createProject(page, 'Keys')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  return page
}

// A text field outside the editor, with typing the Edit menu's Undo would take back.
async function probeWithTyping(page: Page, text: string) {
  await page.evaluate(() => {
    const probe = document.createElement('input')
    probe.id = 'probe'
    probe.setAttribute('aria-label', 'Probe')
    document.body.prepend(probe)
  })
  const probe = page.locator('#probe')
  await probe.click()
  await page.keyboard.type(text)
  await expect(probe).toHaveValue(text)
  return probe
}

test('Mod+Z on the canvas undoes the variant change and not the Edit menu undo', async () => {
  const page = await openEditor()
  const title = await page.getByRole('heading', { level: 3 }).first().textContent()
  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByRole('textbox', { name: 'Variant title' }).fill('Spring launch post')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Spring launch post' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  // Control: outside the editor nothing handles Mod+Z, so the Edit menu's Undo takes it.
  const probe = await probeWithTyping(page, 'abc')
  await page.getByRole('button', { name: 'Back to project' }).focus()
  await page.keyboard.press(`${MOD}+KeyZ`)
  await expect(probe).toHaveValue('')

  await probe.click()
  await page.keyboard.type('xyz')
  const seen = page.evaluate(
    () =>
      new Promise<{ code: string; prevented: boolean }>((done) =>
        window.addEventListener('keydown', (e) => {
          if (e.code === 'KeyZ') done({ code: e.code, prevented: e.defaultPrevented })
        }),
      ),
  )
  await page.getByRole('region', { name: /^Canvas, / }).focus()
  await page.keyboard.press(`${MOD}+KeyZ`)
  expect(await seen).toEqual({ code: 'KeyZ', prevented: true })
  await expect(page.getByRole('heading', { name: title ?? '' })).toBeVisible()
  await expect(probe).toHaveValue('xyz')
})

test('Mod+= zooms the canvas, never the page', async () => {
  const page = await openEditor()
  const pageZoom = () =>
    app!.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .filter((w) => !w.webContents.getURL().endsWith('/render.html'))
        .map((w) => w.webContents.getZoomFactor()),
    )
  const bar = page.getByRole('region', { name: /^Canvas, / })
  await expect(bar.getByRole('button', { name: 'Fit' })).toBeVisible()

  // Control: outside the editor nothing handles Mod+=; with no View menu nothing zooms.
  await page.getByRole('button', { name: 'Back to project' }).focus()
  await page.keyboard.press(`${MOD}+Equal`)
  await expect(bar.getByRole('button', { name: 'Fit' })).toBeVisible()
  expect(await pageZoom()).toEqual([1])

  await bar.focus()
  await page.keyboard.press(`${MOD}+Equal`)
  await expect(bar.getByRole('button', { name: /^\d+%$/ })).toBeVisible()
  expect(await pageZoom()).toEqual([1])
})
