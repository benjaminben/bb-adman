// P9-6: Settings, Cloud storage, the Dropbox part. State is planted by test functions only: no
// sign-in runs, no browser opens, no port is bound and no request goes to Dropbox. The account
// name is made up and the planted refresh token is a made-up string the screen never sees.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { makeSandbox, launch } from '../e2e/launch'
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

// Every command this throwaway app is sent stays unanswered, so "Sign in to Dropbox" waits
// without the real sign-in starting.
async function holdCommands(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('adman:command')
    ipcMain.handle('adman:command', () => new Promise(() => undefined))
  })
}

// A saved account in settings.json before launch, then a saved token through the app's own
// safeStorage (the mock keychain), as a finished sign-in leaves them.
async function openSignedIn(): Promise<Session> {
  const box = makeSandbox()
  const file = path.join(box.userData, 'settings.json')
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  const dropbox = { accountName: 'Ann Example', rootPath: 'Spring campaigns' }
  fs.writeFileSync(file, JSON.stringify({ ...settings, storage: { s3: null, dropbox } }))
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  const secrets = JSON.stringify({ 'dropbox.refreshToken': 'made-up-refresh-token' })
  const sealed = await app.evaluate(
    ({ safeStorage }, text) => safeStorage.encryptString(text).toString('base64'),
    secrets,
  )
  fs.writeFileSync(path.join(box.userData, 'secrets.bin'), Buffer.from(sealed, 'base64'))
  return { box, app, page }
}

test('Settings, Dropbox not signed in', async () => {
  session = await openApp()
  const { page } = session
  await screens.openSettings(page)
  const part = page.getByRole('group', { name: 'Dropbox' })
  await expect(part.getByText('Not signed in.')).toBeVisible()
  await part.scrollIntoViewIfNeeded()
  await shot(page, '270-settings-dropbox-signed-out')
})

test('Settings, Dropbox waiting for the browser', async () => {
  session = await openApp()
  const { app, page } = session
  await holdCommands(app)
  await screens.openSettings(page)
  const part = page.getByRole('group', { name: 'Dropbox' })
  await part.getByRole('button', { name: 'Sign in to Dropbox' }).click()
  await expect(part.getByText('Waiting for you to finish in the browser…')).toBeVisible()
  await expect(part.getByRole('button', { name: 'Sign in to Dropbox' })).toBeDisabled()
  await part.scrollIntoViewIfNeeded()
  await shot(page, '271-settings-dropbox-waiting')
})

test('Settings, Dropbox signed in', async () => {
  session = await openSignedIn()
  const { page } = session
  await screens.openSettings(page)
  const part = page.getByRole('group', { name: 'Dropbox' })
  await expect(part.getByText('Signed in as Ann Example.')).toBeVisible()
  await expect(part.getByLabel('Folder in the app folder')).toHaveValue('Spring campaigns')
  await part.scrollIntoViewIfNeeded()
  await shot(page, '272-settings-dropbox-signed-in')
})
