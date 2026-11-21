// ST-6: the start screen in two columns, the wordmark and the three drawings on the left, the
// cards and two recent projects on the right. Once mid-cycle with motion, once still with
// reduce motion (the finished drawing).
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function startWithRecents(page: Page): Promise<void> {
  await screens.createProject(page, 'Alpine Spring')
  await screens.createProject(page, 'Harbour Lights')
  await screens.showStart(page)
  await expect(page.getByRole('heading', { name: 'Adman', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Open Alpine Spring/ })).toBeVisible()
}

test('The start screen and its drawings, moving', async () => {
  session = await openApp()
  await startWithRecents(session.page)
  // Part way through the 16s cycle, when every part of each drawing is in.
  await session.page.waitForTimeout(7000)
  await shot(session.page, '188-start-drawings')
})

test('The start screen with reduce motion: the finished drawings, still', async () => {
  session = await openApp()
  await session.page.emulateMedia({ reducedMotion: 'reduce' })
  await startWithRecents(session.page)
  await shot(session.page, '189-start-reduced-motion')
})
