// P8-10: the Settings "Export" section with JPG chosen and a made-up exporter's name saved.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('The Export section in Settings', async () => {
  session = await openApp()
  const { page } = session
  await screens.openSettings(page)
  const box = page.getByRole('region', { name: 'Export' })
  await box.getByLabel('Picture format').selectOption('jpg')
  const quality = box.getByLabel('JPG quality')
  await quality.fill('85')
  await quality.press('Enter')
  const name = box.getByLabel('Name shown in reports')
  await name.fill('Rowan Vale')
  await name.press('Enter')
  await expect(name).toHaveValue('Rowan Vale')
  await box.scrollIntoViewIfNeeded()
  await shot(page, '250-settings-export')
})
