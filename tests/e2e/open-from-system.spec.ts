// R2P-9 (spec/phases/round-2-platform.md, D9): a project file the system hands the app opens
// through project.open and the window is told to show it with app.showProject, whether it
// was open already or not. A second launch of the built app with a project path on its command
// line hands the path to the running app and exits. The test listens for the event in the
// page through window.api; it adds nothing to the main process.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { makeSandbox, launch, quietEnv, type Sandbox } from './launch'
import { command, query } from './render-helpers'

const electronBin = createRequire(import.meta.url)('electron') as unknown as string

type Shown = { api: { on: (n: string, l: (p: { projectId: string }) => void) => void } }
type Opened = { projectId: string; filePath: string }

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
  fs.mkdirSync(box.projects, { recursive: true })
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

async function listenForShows(page: Page): Promise<() => Promise<string[]>> {
  await page.waitForFunction(() => 'api' in window)
  await page.evaluate(() => {
    const w = window as unknown as Shown & { shown: string[] }
    w.shown = []
    w.api.on('app.showProject', (p) => w.shown.push(p.projectId))
  })
  return () => page.evaluate(() => (window as unknown as { shown: string[] }).shown)
}

const create = async (page: Page, name: string) =>
  (await command(page, 'project.create', { name, location: box.projects })) as Opened

async function closedProject(page: Page, name: string): Promise<Opened> {
  const made = await create(page, name)
  await command(page, 'project.close', { projectId: made.projectId })
  return made
}

const openIds = async (page: Page) => {
  const state = (await query(page, 'app.getState', {})) as { openProjects: Opened[] }
  return state.openProjects.map((p) => p.projectId)
}

function systemOpen(running: ElectronApplication, filePath: string): Promise<void> {
  return running.evaluate(({ app: main }, p) => {
    main.emit('open-file', { preventDefault: () => undefined }, p)
  }, filePath)
}

// The built app started again on the same data folder, as Finder or Explorer would start it.
function secondLaunch(filePath: string): Promise<number | null> {
  const child = spawn(electronBin, ['.', '--use-mock-keychain', filePath], {
    env: {
      ...process.env,
      ADMAN_USER_DATA_DIR: box.userData,
      ADMAN_FAKE_PROVIDERS: '1',
      ...quietEnv(process.env),
    },
    stdio: 'ignore',
  })
  return new Promise((resolve) => child.on('exit', (code) => resolve(code)))
}

test('a system open shows the project, open already or not [R2P-9, D9]', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  const shown = await listenForShows(page)
  const first = await create(page, 'Spring Launch')
  const second = await create(page, 'Summer Sale')
  await systemOpen(app, first.filePath)
  await expect.poll(shown).toEqual([first.projectId])
  expect(await openIds(page)).toEqual([first.projectId, second.projectId])

  const third = await closedProject(page, 'Autumn Picks')
  await systemOpen(app, third.filePath)
  await expect.poll(shown).toEqual([first.projectId, third.projectId])
  expect(await openIds(page)).toContain(third.projectId)
})

test('a second launch hands its project to the running app and exits [R2P-9, D9]', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  const shown = await listenForShows(page)
  const handed = await closedProject(page, 'Winter Lights')
  expect(await secondLaunch(handed.filePath)).toBe(0)
  await expect.poll(shown, { timeout: 20_000 }).toEqual([handed.projectId])
  expect(await openIds(page)).toEqual([handed.projectId])
})

// The lock is keyed on the data folder, so test apps with their own folders run side by side.
test('two apps with different data folders both start [R2P-9, D9]', async () => {
  const otherBox = makeSandbox()
  app = await launch(box)
  const other = await launch(otherBox)
  try {
    const pages = [await app.firstWindow(), await other.firstWindow()]
    for (const page of pages) expect(await openIds(page)).toEqual([])
  } finally {
    await other.close()
    fs.rmSync(otherBox.root, { recursive: true, force: true })
  }
})
