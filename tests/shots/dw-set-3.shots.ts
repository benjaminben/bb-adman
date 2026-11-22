// SET-3 (spec/phases/design-wave-screens-a.md): the Files page. 414 JPG chosen and a long
// projects folder, cut in the middle on the row. Settings are planted in the sandbox before the
// window draws. The folder and the report name are made up; nothing leaves this machine.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { makeSandbox, launch } from '../e2e/launch'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { closeApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

const FOLDER = '/Users/ann/Documents/Client work/Harbour Lane Bakery/Spring launch/Adman Projects'

async function openPlanted(): Promise<Session> {
  const box = makeSandbox()
  const file = path.join(box.userData, 'settings.json')
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  const exported = (settings.export ?? {}) as Record<string, unknown>
  fs.writeFileSync(
    file,
    JSON.stringify({
      ...settings,
      defaultProjectDir: FOLDER,
      export: { ...exported, imageFormat: 'jpg', jpgQuality: 85 },
      reports: { exporterName: 'Ann Example' },
    }),
  )
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  return { box, app, page }
}

async function holdStill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('Files page, JPG chosen and a long projects folder', async () => {
  session = await openPlanted()
  const { page } = session
  await holdStill(page)
  await screens.openSettingsPage(page, 'Files')
  const folder = page.getByRole('region', { name: 'Projects folder' })
  await expect(folder.locator('[title]')).toHaveAttribute('title', FOLDER)
  await expect(page.getByRole('group', { name: 'Picture format' })).toBeVisible()
  await expect(page.getByLabel('JPG quality')).toHaveValue('85')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '414-settings-files')
})
