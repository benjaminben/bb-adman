// SET-4 (spec/phases/design-wave-screens-a.md): the Publish page. 415 Amazon S3 set up and
// connected, Dropbox signed in, approvals not set; 416 the S3 row open with a failed test. State
// is planted in the sandbox before the window draws. Nothing leaves this machine: each Test is
// answered inside the app, so no request goes to S3. The bucket, keys and account name are made
// up.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
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

const S3 = { bucket: 'made-up-ad-pictures', region: 'eu-west-1', prefix: '' }
const S3_KEYS = { 's3.accessKeyId': 'MADEUPKEYIDQ7RT', 's3.secretAccessKey': 'made-up-secret-0001' }
// The main process's sentence for keys Amazon S3 does not accept (s3_wrong_keys).
const WRONG_KEYS =
  'Amazon S3 did not accept these keys. Check the access key ID and the secret access key.'
const CONNECTED = { ok: true, data: { ok: true } }
const REFUSED = {
  ok: false,
  error: { code: 'PROVIDER_ERROR', message: WRONG_KEYS, details: { reason: 's3_wrong_keys' } },
}

// Saved settings before launch, then saved secrets through the app's own safeStorage (the mock
// keychain), as a finished setup leaves them.
async function openPlanted(storage: object, secrets: Record<string, string>): Promise<Session> {
  const box = makeSandbox()
  const file = path.join(box.userData, 'settings.json')
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  fs.writeFileSync(file, JSON.stringify({ ...settings, storage }))
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  const sealed = await app.evaluate(
    ({ safeStorage }, text) => safeStorage.encryptString(text).toString('base64'),
    JSON.stringify(secrets),
  )
  fs.writeFileSync(path.join(box.userData, 'secrets.bin'), Buffer.from(sealed, 'base64'))
  return { box, app, page }
}

// storage.checkS3 is answered in the main process with the given reply; every other command
// goes to the app's own handler.
async function answerCheckS3(app: ElectronApplication, reply: object): Promise<void> {
  await app.evaluate(({ ipcMain }, answer) => {
    type Handler = (event: unknown, name: string, input: unknown) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
      ._invokeHandlers
    const original = handlers.get('adman:command')
    if (original === undefined) throw new Error('No command handler')
    ipcMain.removeHandler('adman:command')
    ipcMain.handle('adman:command', (event, name: string, input: unknown) =>
      name === 'storage.checkS3' ? answer : original(event, name, input),
    )
  }, reply)
}

async function holdStill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('Publish page, S3 connected and Dropbox signed in', async () => {
  session = await openPlanted(
    { s3: S3, dropbox: { accountName: 'Ann Example', rootPath: 'Spring campaigns' } },
    { ...S3_KEYS, 'dropbox.refreshToken': 'made-up-refresh-token' },
  )
  const { app, page } = session
  await answerCheckS3(app, CONNECTED)
  await holdStill(page)
  await screens.openSettingsPage(page, 'Publish')
  const s3 = page.getByRole('group', { name: 'Amazon S3' })
  await s3.getByRole('button', { name: 'Test connection' }).click()
  await expect(s3.getByText('Connected', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Dropbox' }).getByText('Ann Example', { exact: true }),
  ).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '415-settings-publish')
})

test('Publish page, the S3 row open with a failed test', async () => {
  session = await openPlanted({ s3: S3, dropbox: null }, S3_KEYS)
  const { app, page } = session
  await answerCheckS3(app, REFUSED)
  await holdStill(page)
  await screens.openSettingsPage(page, 'Publish')
  const s3 = page.getByRole('group', { name: 'Amazon S3' })
  await s3.getByRole('button', { name: 'Amazon S3', exact: true }).click()
  await s3.getByRole('button', { name: 'Test connection' }).click()
  await expect(s3.getByText('Failed', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await shot(page, '416-settings-publish-s3-failed')
})
