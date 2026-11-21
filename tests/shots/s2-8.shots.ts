// S2-8: Settings, the models whose commercial licence the user confirmed. Two names written
// into the sandbox settings.json before launch, each with "Forget"; then the empty sentence.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { launch, makeSandbox } from '../e2e/launch'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

// The built app with `licenceConfirmed` saved in its settings file, at the shots' window size.
async function openWithLicences(names: string[]): Promise<Session> {
  const box = makeSandbox()
  const file = path.join(box.userData, 'settings.json')
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  fs.writeFileSync(file, JSON.stringify({ ...settings, licenceConfirmed: names }))
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  return { box, app, page }
}

test('Settings with two confirmed licences', async () => {
  session = await openWithLicences(['MiniMax H3', 'FLUX 3 klein'])
  const { page } = session
  await screens.openSettings(page)
  const forget = page.getByRole('button', { name: 'Forget FLUX 3 klein' })
  await expect(forget).toBeVisible()
  await forget.scrollIntoViewIfNeeded()
  await shot(page, '01-settings-confirmed-licences')
})

test('Settings with no confirmed licence', async () => {
  session = await openApp()
  const { page } = session
  await screens.openSettings(page)
  const empty = page.getByText('You have not confirmed a commercial license for any model.')
  await expect(empty).toBeVisible()
  await empty.scrollIntoViewIfNeeded()
  await shot(page, '02-settings-no-confirmed-licence')
})
