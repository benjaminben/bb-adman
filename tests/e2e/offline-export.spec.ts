// P8-19 [REQ: 8.2]: manual work needs no key and no network. The app starts with no secret saved
// (the mock keychain is empty) and its network is turned off from the test process with what
// Electron already offers, nothing added to the app: every session is put offline
// (enableNetworkEmulation) and any http, https or web socket request it still makes is cancelled
// and counted (webRequest); the main process's fetch fails as a dropped network does and counts
// each call (the fetch stub of spec/test-harnesses.md); and a socket connect from the main
// process off this computer is counted and refused. Then, through the screens: a picture is
// imported, placed by hand in the editor, and the ad exported as an image. Each step succeeds
// and nothing tried the network.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import * as screens from './screens'
import { command, query } from './render-helpers'
import { appWindow, filesUnder } from './publish-steps'
import * as ex from './export-steps'

const PHOTO = path.resolve('tests/shots/fixtures/photos/glass-bottle.png')
const CAMPAIGN = 'Quiet Harbour Soda'
const BOX = { x: 340, y: 300, width: 400, height: 400 }

type Tries = { __offlineTries?: string[] }

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  await networkOff(app)
  page = await appWindow(app)
})
test.afterEach(async () => {
  try {
    await answerQuit(app)
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

async function networkOff(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ app: main, session, webContents }) => {
    const seen = globalThis as unknown as Tries
    seen.__offlineTries = []
    const record = (what: string) => seen.__offlineTries?.push(what)
    const urls = ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']
    const off = (s: Electron.Session) => {
      s.enableNetworkEmulation({ offline: true })
      s.webRequest.onBeforeRequest({ urls }, (details, callback) => {
        record(`request ${new URL(details.url).protocol}`)
        callback({ cancel: true })
      })
    }
    off(session.defaultSession)
    for (const contents of webContents.getAllWebContents()) off(contents.session)
    main.on('session-created', off)

    globalThis.fetch = async () => {
      record('fetch')
      throw new TypeError('fetch failed')
    }
    const net = process.getBuiltinModule('node:net')
    const connect = net.Socket.prototype.connect
    net.Socket.prototype.connect = function (this: import('node:net').Socket, ...args: unknown[]) {
      const first = args[0] as { host?: string; path?: string } | number | string
      const host = typeof first === 'object' && first !== null ? first.host : undefined
      const local = typeof first === 'object' && first?.path !== undefined
      if (!local && host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
        record('socket')
        throw new Error('The network is off.')
      }
      return (connect as (...a: unknown[]) => import('node:net').Socket).apply(this, args)
    } as typeof connect
  })
}

const tries = () =>
  app.evaluate(() => (globalThis as unknown as Tries).__offlineTries ?? ['not installed'])

test('with no key and the network off, import, a hand layout and an image export work [8.2]', async () => {
  test.setTimeout(180_000)
  const secrets = async () =>
    ((await query(page, 'app.getState', {})) as { secrets: unknown[] }).secrets
  expect(await secrets()).toEqual([])
  // The guard is live: a fetch and a socket off this computer both fail and are counted.
  const probe = await app.evaluate(async () => {
    const net = process.getBuiltinModule('node:net')
    const failed: string[] = []
    await fetch('https://example.com/').catch(() => failed.push('fetch'))
    try {
      net.connect({ host: 'example.com', port: 443 })
    } catch {
      failed.push('socket')
    }
    const seen = globalThis as unknown as Tries
    const counted = seen.__offlineTries?.splice(0) ?? []
    return { failed, counted }
  })
  expect(probe).toEqual({ failed: ['fetch', 'socket'], counted: ['fetch', 'socket'] })

  // Import: "Import files…" on the project's page, the picture picked in the system dialog.
  await screens.createProject(page, 'Quiet Harbour')
  const picture = path.join(box.root, 'glass-bottle.png')
  fs.copyFileSync(PHOTO, picture)
  await screens.answerOpenDialog(app, [picture])
  await page.getByRole('button', { name: 'Import files…' }).click()
  const importing = page.getByRole('dialog', { name: 'Import 1 file(s)' })
  await importing.getByRole('button', { name: 'Import' }).click()
  await expect(importing.getByText('1 file(s) added.')).toBeVisible()
  await importing.getByRole('button', { name: 'Done' }).click()

  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { variantId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'People on the pier',
      message: 'A quiet fizz by the water',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })) as { variantId: string }

  // A hand layout: a picture layer, the imported picture chosen, its box typed in.
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: 'Add picture layer' }).click()
  const properties = page.getByRole('region', { name: 'Properties' })
  await properties.getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  await chooser.getByRole('button', { name: /glass-bottle/ }).click()
  await expect(chooser).toHaveCount(0)
  const fields = properties.getByRole('group', { name: 'Position and size' })
  for (const [label, value] of [
    ['Width', BOX.width],
    ['Height', BOX.height],
    ['X', BOX.x],
    ['Y', BOX.y],
  ] as const) {
    const field = fields.getByRole('spinbutton', { name: label, exact: true })
    await field.fill(String(value))
    await field.press('Enter')
    await expect(field).toHaveValue(String(value))
  }
  await expect
    .poll(async () => {
      const got = (await query(page, 'variant.get', { projectId, variantId })) as {
        layers: { type: string; source: unknown; geometry: Record<string, number> }[]
      }
      const placed = got.layers.find((l) => l.type === 'image' && l.source !== null)
      return placed && { x: placed.geometry.x, y: placed.geometry.y, width: placed.geometry.width }
    })
    .toEqual({ x: BOX.x, y: BOX.y, width: BOX.width })

  // An image export through the Export dialog.
  await page.getByRole('tab', { name: 'Overview' }).click()
  const folder = ex.outputFolder(box.root, 'Quiet Harbour export')
  const dialog = await ex.openExport(app, page, folder)
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await ex.finishExport(dialog, 'Exported 1 ads. 0 failed.')
  const files = filesUnder(folder)
  expect(files.filter((f) => f.endsWith('.png'))).toHaveLength(1)
  expect(files.filter((f) => /report-[^/]+\.(html|json)$/.test(f))).toHaveLength(2)

  expect(await tries()).toEqual([])
  expect(await secrets()).toEqual([])
})
