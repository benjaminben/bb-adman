// R2P-6: the permission dialog for files. An MCP client on this machine asks import_assets
// and create_campaign_from_brief with made-up paths; each dialog is pictured once its list is
// shown and Import or Allow is ready, then refused, so nothing is read or imported. 373 three
// files, 374 twenty long paths, 375 the brief command's dialog. Reduce motion and a fixed
// Math.random keep every picture still. Nothing is paid and nothing leaves the machine.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { toolSession, type ToolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'
import { markdownBrief } from '../integration/mcp/brief-tool-fixture'
import { closeApp, openApp, shot, type Session } from './shot'

const PROJECT = 'Lakeside Beauty'
const SHOOTS = '/Users/sam/Shoots/Lakeside Beauty'
const THREE = [
  `${SHOOTS}/Serum/serum-front.jpg`,
  `${SHOOTS}/Serum/serum-side.png`,
  `${SHOOTS}/Models/model-01-morning-light.jpg`,
]
const TWENTY = Array.from(
  { length: 20 },
  (_, i) =>
    `${SHOOTS}/Autumn and Winter Campaign Selects/Day ${(i % 4) + 1} Harbour Walk/` +
    `retouched-final-v${i + 1}-for-social-and-print-${String(i + 1).padStart(2, '0')}.jpg`,
)

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

async function projectId(page: Page): Promise<string> {
  await screens.createProject(page, PROJECT)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; name: string }[]
  }
  return state.openProjects.find((p) => p.name === PROJECT)!.projectId
}

// Pictures the dialog with its list shown and the allow button ready, then refuses it.
async function shootAndRefuse(page: Page, pending: Promise<unknown>, at: Shot) {
  const dialog = page.getByRole('dialog', { name: at.title })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByRole('list', { name: 'Files' }).getByRole('listitem')).toHaveCount(
    at.count,
  )
  await expect(dialog.getByRole('button', { name: 'Refuse' })).toBeFocused()
  await expect(dialog.getByRole('button', { name: at.allow })).not.toHaveAttribute('aria-disabled')
  await shot(page, at.name)
  await dialog.getByRole('button', { name: 'Refuse' }).click()
  await expect(dialog).toBeHidden()
  await pending
}

type Shot = { title: string; allow: string; count: number; name: string }

function importAsk(s: ToolSession, id: string, paths: string[]) {
  return s.call('import_assets', { project_id: id, paths })
}

test('R2P-6 shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  await still(page)
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const s = await toolSession(port, token)
  const id = await projectId(page)
  const files = { title: 'An agent asks to import files', allow: 'Import' }

  await shootAndRefuse(page, importAsk(s, id, THREE), {
    ...files,
    count: 3,
    name: '373-permission-three-files',
  })
  await shootAndRefuse(page, importAsk(s, id, TWENTY), {
    ...files,
    count: 20,
    name: '374-permission-twenty-long-paths',
  })
  const brief = s.call('create_campaign_from_brief', {
    project_id: id,
    text: markdownBrief([`${SHOOTS}/Serum/serum-front.jpg`]),
  })
  await shootAndRefuse(page, brief, {
    title: 'An agent asks to make a campaign with files',
    allow: 'Allow',
    count: 1,
    name: '375-permission-brief-files',
  })
})
