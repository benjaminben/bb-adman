// ED-5 (spec/phases/design-wave-screens-a.md): the editor header. 433: the header of a video
// master at 1280px, one line: the title, Master, the size chip, Format with Video pressed and
// Length, then the icon buttons. 434: a text that does not fit, the short warn line with its
// InfoTip open. Nothing is generated. Made-up words only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { chooseFormat, expectFormat } from '../e2e/format-steps'
import { firstIds } from '../e2e/held-run'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const LONG =
  'Lanterns glow along the quiet harbour wall as the evening boats drift home with the tide, ' +
  'and the whole town comes down to the water to watch them land'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign.
async function campaign(s: Session, name: string): Promise<void> {
  const { app, page } = s
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
}

async function still(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400)
  await shot(page, name)
}

test('433 the header of a video master', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { page } = session
  await campaign(session, 'Harbour Lights')
  await screens.openMaster(page)
  await chooseFormat(page, 'Video')
  await expectFormat(page, 'Video')
  await expect(page.getByRole('textbox', { name: 'Length (seconds)' })).toBeVisible()
  await page.mouse.move(640, 790)
  await still(page, '433-editor-header-video')
})

test('434 a text that does not fit, with the fix in its InfoTip', async () => {
  test.setTimeout(150_000)
  session = await openApp()
  const { page } = session
  await campaign(session, 'Harbour Lights')
  const { projectId, variantId } = await firstIds(page)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string }[]
  }
  const text = got.layers.find((l) => l.type === 'text')!
  await command(page, 'layer.update', {
    projectId,
    layerId: text.id,
    patch: { copy: LONG.repeat(4) },
  })
  await screens.openMaster(page)
  await expect(
    page.getByRole('status').filter({ hasText: /^\d+ texts? do(es)? not fit$/ }),
  ).toBeVisible()
  const tip = page.getByRole('button', { name: 'About fixing it' })
  await tip.click()
  await expect(
    page.getByText('Make the box larger, the text smaller, or shorten the text.'),
  ).toBeVisible()
  await still(page, '434-editor-overflow-banner')
})
