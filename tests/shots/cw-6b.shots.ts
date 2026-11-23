// CW-6b: the permission dialog for an agent's ComfyUI workflow. An MCP client on this machine
// calls add_comfy_workflow with a made-up graph of many node types; the dialog is pictured once
// its list is shown and Add is ready (530), then Add is pressed, so the app holds the workflow
// in its sandbox profile. The client then calls remove_comfy_workflow; that delete dialog is
// pictured (531) and refused. No ComfyUI server is called: adding and asking only check the
// text. Reduce motion and a fixed Math.random keep every picture still. Nothing leaves the
// machine.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { command, query } from '../e2e/render-helpers'
import { replyJson, toolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'
import { fixtureText } from '../fixtures/comfy-custom/load'
import { closeApp, openApp, shot, type Session } from './shot'

// At most 60 characters, the workflow name rule.
const NAME = 'Soft studio light, film grain and warm grade for skin care'

// Made-up custom node names, the kind found on a ComfyUI server, some of them very long.
const EXTRA = [
  'ImageScaleBy',
  'ImageSharpen',
  'ImageBlur',
  'FilmGrainAdvanced',
  'ColorCorrectWarmGradeLUTApplyWithStrengthAndMaskSupportForPortraitRetouching',
  'FaceRestoreWithModel',
  'UpscaleModelLoader',
  'ImageUpscaleWithModel',
  'SaveImageToNetworkFolder',
  'HTTPPostImageToWebhook',
  'LoadImageFromURL',
  'PaidCloudUpscaleService',
  'ImageCompositeMasked',
  'ImageInvert',
]

// The picture fixture with each extra node fed by the decoded picture.
function longGraph(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  EXTRA.forEach((type, index) => {
    graph[String(20 + index)] = {
      class_type: type,
      inputs: { image: ['8', 0] },
      _meta: { title: type },
    }
  })
  return JSON.stringify(graph)
}

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

// The shared shot() grows the window to fit every scrolling box; a long list scrolls inside
// the dialog by design, so that picture is taken at the normal window size instead.
async function windowShot(page: Page, name: string) {
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', `${name}.png`) })
}

test('CW-6b shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  await still(page)
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const s = await toolSession(port, token)

  const adding = s.call('add_comfy_workflow', { name: NAME, workflow_json: longGraph() })
  const add = page.getByRole('dialog', { name: 'An agent asks to add a ComfyUI workflow' })
  await expect(add).toBeVisible({ timeout: 30_000 })
  const types = add.getByRole('list', { name: 'Node types it uses' }).getByRole('listitem')
  await expect(types).toHaveCount(EXTRA.length + 6)
  await expect(add.getByRole('button', { name: 'Refuse' })).toBeFocused()
  const allow = add.getByRole('button', { name: 'Add' })
  await expect(allow).not.toHaveAttribute('aria-disabled')
  await windowShot(page, '530-permission-workflow-add-long-list')
  await allow.click()
  await expect(add).toBeHidden()
  const { workflowId } = replyJson<{ workflowId: string }>(await adding)

  const removing = s.call('remove_comfy_workflow', { workflow_id: workflowId })
  const remove = page.getByRole('dialog', { name: 'An agent asks to delete' })
  await expect(remove).toBeVisible({ timeout: 30_000 })
  await expect(remove.getByRole('button', { name: 'Allow' })).not.toHaveAttribute('aria-disabled')
  await shot(page, '531-permission-workflow-remove')
  await remove.getByRole('button', { name: 'Refuse' }).click()
  await expect(remove).toBeHidden()
  await removing
})
