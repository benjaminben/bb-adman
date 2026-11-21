// ST-2: the base controls on the Settings screen, which shows most control kinds: buttons,
// text and number fields, selects, the agent access checkbox, cards and labels.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The base controls on the Settings screen', async () => {
  session = await openApp()
  const { page } = session
  await expect(page.getByRole('button', { name: 'Adman' })).toBeVisible()
  const comfy = await screens.openSettings(page)
  await expect(comfy).toBeVisible()
  await shot(page, '182-settings-controls')
})
