// R2P-12 (spec/phases/round-2-platform.md, D7 and D9): the agent path in the real app. The user
// turns on agent access in Settings and works in their own project; an MCP client in this test
// process creates a project and asks to import two drawn pictures by full path. 381 the import
// dialog with its list of paths, ready to answer; 382 the switcher's menu listing the agent's
// project while the window stays on the user's. Reduce motion and a fixed Math.random keep the
// pictures still. Nothing is paid and nothing leaves the machine; the token is never shown.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { writePng } from '../e2e/drop-files'
import { connectThroughSettings } from '../e2e/mcp-workflow-steps'
import { replyJson } from '../integration/mcp/tool-client'
import { closeApp, openApp, shot, type Session } from './shot'

const MINE = 'Harbour Lights'
const AGENTS = 'Fern Studio Spring'

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

test('R2P-12 shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page, box } = session
  await still(page)
  const tool = await connectThroughSettings(page)
  await screens.createProject(page, MINE)

  const dir = path.join(fs.realpathSync(box.root), 'Agent pictures')
  fs.mkdirSync(dir)
  const files = ['fern-leaf-tile.png', 'moss-circle.png'].map((n) => path.join(dir, n))
  files.forEach((f, i) => writePng(f, [40 + i * 50, 140, 90 - i * 20]))

  const created = replyJson<{ projectId: string }>(
    await tool.call('create_project', { name: AGENTS }),
  )
  const pending = tool.call('import_assets', { project_id: created.projectId, paths: files })
  const dialog = page.getByRole('dialog', { name: 'An agent asks to import files' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByRole('list', { name: 'Files' }).getByRole('listitem')).toHaveText(files)
  await expect(dialog.getByRole('button', { name: 'Import' })).not.toHaveAttribute('aria-disabled')
  await shot(page, '381-agent-import-dialog')
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog).toBeHidden()
  expect((await pending).isError).toBeFalsy()

  await expect(page.getByRole('heading', { name: MINE, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: `${MINE} · 2 open` }).click()
  await expect(page.getByRole('menuitem', { name: AGENTS })).toBeVisible()
  await shot(page, '382-switcher-lists-agent-project')
})
