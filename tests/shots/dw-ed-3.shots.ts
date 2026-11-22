// ED-3 (spec/phases/design-wave-screens-a.md): the picture and background layer. 427: the
// background after a fake picture run, the picture at full width with its icon bar, Opacity,
// Background colour and Shade folded. 446 (a free number): the same background while its
// cut-out runs, the ring over the picture. 428: an empty picture layer, "Empty picture" with
// "Choose picture…". The campaign comes from the S2-16 brief; the fake provider only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign.
async function campaign(s: Session): Promise<void> {
  const { app, page } = s
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
}

const properties = (page: Page) => page.getByRole('region', { name: 'Properties' })

// The cut-out's end never reaches this window, so the ring stays for the picture: in the main
// process, a finished cut-out's job.updated is not sent and job.list answers no jobs. The
// fake provider still runs; nothing leaves the computer.
async function holdCutOut(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow, ipcMain }) => {
    type Message = { name?: string; payload?: { kind?: string; status?: string } }
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    for (const win of BrowserWindow.getAllWindows()) {
      const contents = win.webContents
      const send = contents.send.bind(contents)
      contents.send = (channel: string, ...args: unknown[]) => {
        const msg = args[0] as Message | undefined
        const p = msg?.payload
        const done = msg?.name === 'job.updated' && p?.kind === 'cutout' && p.status !== 'running'
        if (!(done && p.status !== 'queued')) send(channel, ...args)
      }
    }
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
      ._invokeHandlers
    const query = handlers.get('adman:query')
    if (query === undefined) throw new Error('no query handler')
    handlers.set('adman:query', (event, name, input) =>
      name === 'job.list' ? { ok: true, data: [] } : query(event, name, input),
    )
  })
}

async function still(page: Page, name: string): Promise<void> {
  await page.mouse.move(640, 790)
  await page.waitForTimeout(300)
  await shot(page, name)
}

test('A background after a run, and its cut-out running', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await campaign(session)
  await screens.setPrompt(page, 'Snowy alpine meadow at sunrise, soft light, no people')
  await screens.chooseProvider(page, 'Fake provider')
  await screens.generate(page)
  await expect(screens.picturePanel(page).getByText(screens.ON_THE_LAYER)).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /^Activity/ }).click()
  await expect(screens.activityPanel(page)).toBeHidden()
  const picture = properties(page).getByRole('group', { name: 'Picture' })
  await expect(picture.locator('img')).toBeVisible()
  await expect(properties(page).getByRole('button', { name: 'Shade' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await still(page, '427-background-after-run')

  await holdCutOut(app)
  await picture.getByRole('button', { name: 'Cut out the subject…' }).click()
  const run = page.getByRole('dialog', { name: 'Cut out the subject' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('button', { name: 'Cut out' }).click()
  await expect(run).toBeHidden()
  await expect(picture.locator('[data-cut-out-ring]')).toBeVisible()
  await expect(picture.getByRole('status')).toHaveText('Cutting out…')
  await still(page, '446-background-cut-out-running')
})

test('An empty picture layer', async () => {
  session = await openApp()
  const { page } = session
  await campaign(session)
  await screens.openMaster(page)
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  await expect(properties(page).getByText('Empty picture', { exact: true })).toBeVisible()
  await expect(properties(page).getByRole('button', { name: 'Choose picture…' })).toBeVisible()
  await still(page, '428-picture-layer-empty')
})
