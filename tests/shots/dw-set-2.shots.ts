// SET-2 (spec/phases/design-wave-screens-a.md): the AI services page. 412 one key saved and the
// stand-in ComfyUI server checked, one workflow missing items; 413 the same with Licences and On
// the server open. The key is made up, the server is the stand-in on 127.0.0.1, and reduce
// motion and a fixed Math.random keep the window still. Nothing leaves this machine.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import * as screens from '../e2e/screens'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { answerQuit } from '../e2e/quit-answer'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    if (session) await answerQuit(session.app)
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

type Api = { api: { query: (n: string, i: unknown) => Promise<{ data: unknown }> } }
type CommandApi = { api: { command: (n: string, i: unknown) => Promise<unknown> } }

async function holdStill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

// The stand-in lists every model but those of one workflow, so that one row shows what is
// missing and the others are complete.
async function lackOneWorkflow(page: Page, server: StandIn, label: string): Promise<void> {
  const info = (await page.evaluate(
    async () => (await (window as unknown as Api).api.query('comfy.getInfo', {})).data,
  )) as ComfyInfo
  const live = info.workflows.filter((w) => w.status !== 'draft')
  const lacking = live.find((w) => w.label === label)
  if (!lacking) throw new Error(`no workflow ${label}`)
  const folders = new Map<string, string[]>()
  for (const w of live.filter((w) => w !== lacking)) {
    for (const m of w.needs.models)
      folders.set(m.folder, [...(folders.get(m.folder) ?? []), m.file])
  }
  for (const m of lacking.needs.models) {
    const files = (folders.get(m.folder) ?? []).filter((f) => f !== m.file)
    server.reply(`GET /models/${m.folder}`, { json: files })
  }
}

test('Settings, AI services: a key saved and a checked server', async () => {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { page } = session
  await holdStill(page)
  await serveNeedsFromApp(page, stand)
  await lackOneWorkflow(page, stand, screens.H3_TEXT_LABEL)
  await page.evaluate(
    async () =>
      await (window as unknown as CommandApi).api.command('settings.update', {
        licenceConfirmed: ['FLUX 3 klein'],
      }),
  )

  const comfy = await screens.openSettings(page)
  const row = page.getByRole('group', { name: 'Google Gemini API key' })
  await row.getByRole('button', { name: 'Add key' }).click()
  await row.getByLabel('New Google Gemini API key').fill('made-up-shot-value-7KQ2')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('•••7KQ2')).toBeVisible()

  await screens.saveAddress(comfy, stand.origin)
  await screens.checkServer(comfy)
  await expect(screens.workflowRow(comfy, screens.H3_TEXT_LABEL)).toContainText('missing')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '412-settings-ai-services-checked')

  await comfy.getByRole('button', { name: 'Licences' }).click()
  await comfy.getByRole('button', { name: 'On the server' }).click()
  await expect(comfy.getByRole('button', { name: 'Forget FLUX 3 klein' })).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '413-settings-ai-services-folds-open')
})
