// DLG-2 (spec/phases/design-wave-screens-b.md, "DLG-2"): the three confirms. 469, the delete
// warning for a variant; 470, an agent's ask to import files, with made-up paths under a
// temporary folder (one long enough to wrap), pictured once Import is ready, then refused so
// nothing is read; 471, the licence dialog for an H3 video run against the stand-in ComfyUI on
// 127.0.0.1. The fake provider and the stand-in only: nothing is paid or leaves the machine.
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import * as v from '../e2e/variants-steps'
import { command, query } from '../e2e/render-helpers'
import { serveNeedsFromApp } from '../e2e/stand-in-runs'
import { reopenAsVideo } from '../e2e/timeline-seed'
import { toolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'
import { closeApp, openApp, shot, type Session } from './shot'

const DIRECTION = 'Direction 1'
const WIDE = '16x9 (1920×1080)'
const SHOOT = '/tmp/adman-dlg-2/Harbour Walk Selects'
const FILES = [
  `${SHOOT}/Day 2 Morning Light/retouched-final-v7-for-social-and-print-harbour-walk-wide.jpg`,
  `${SHOOT}/serum-front.jpg`,
  `${SHOOT}/serum-side.png`,
]

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('469 the delete warning for a variant', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  await v.createFromForm(app, page, { languages: 'en, de', sizes: [WIDE] })
  await v.fanOut(page, DIRECTION, { languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(2)
  const title = await v.tileMore(page, v.tile(page, DIRECTION, '· de'), 'Delete…')
  const dialog = page.getByRole('dialog', { name: `Delete ${title}?` })
  await expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused()
  await shot(page, '469-delete-variant-confirm')
})

test('470 an agent asks to import files', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  await still(page)
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const tools = await toolSession(port, token)
  await screens.createProject(page, 'Lakeside Beauty')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; name: string }[]
  }
  const id = state.openProjects.find((p) => p.name === 'Lakeside Beauty')!.projectId
  const asked = tools.call('import_assets', { project_id: id, paths: FILES })

  const dialog = page.getByRole('dialog', { name: 'An agent asks to import files' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  const items = dialog.getByRole('list', { name: 'Files' }).getByRole('listitem')
  await expect(items).toHaveText(FILES)
  await expect(dialog.getByRole('button', { name: 'Refuse' })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Import' })).not.toHaveAttribute('aria-disabled')
  await shot(page, '470-permission-import-files')
  await dialog.getByRole('button', { name: 'Refuse' }).click()
  await expect(dialog).toBeHidden()
  await asked
})

test('471 the licence dialog for an H3 video run', async () => {
  test.setTimeout(240_000)
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  const { app, page } = session
  await still(page)
  stand = await startComfyStandIn()
  await serveNeedsFromApp(page, stand)
  await screens.saveAddress(await screens.openSettings(page), stand.origin)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await reopenAsVideo(page, 'Summer Launch')
  await screens.openCampaign(page)
  await screens.startVideo(page, 2)
  const dialog = screens.licenceDialog(page)
  await expect(dialog.getByRole('checkbox')).toBeFocused()
  await shot(page, '471-licence-confirm')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})
