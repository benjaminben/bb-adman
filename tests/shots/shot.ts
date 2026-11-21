// One screenshot of the whole page, saved as shots/{name}.png. Each screen slice adds its
// own `tests/shots/{slice}.shots.ts` file and calls this; names are `NN-screen-state`.
import type { ElectronApplication, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from '../e2e/launch'

const FOLDER = path.resolve('shots')

export type Session = { box: Sandbox; app: ElectronApplication; page: Page }

const WIDTH = 1280
const HEIGHT = 800

// How much taller the window must be for nothing to need scrolling.
function hiddenHeight(): number {
  let extra = 0
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el)
    if (style.overflowY === 'visible' && el !== document.documentElement) continue
    extra = Math.max(extra, el.scrollHeight - el.clientHeight)
  }
  return extra
}

// The window grows to fit the whole screen for the picture, then goes back.
export async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(FOLDER, { recursive: true })
  const extra = await page.evaluate(hiddenHeight)
  await page.setViewportSize({ width: WIDTH, height: HEIGHT + extra })
  await page.screenshot({ path: path.join(FOLDER, `${name}.png`) })
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
}

// The built app in sandbox folders, with the fake providers, at a fixed window size.
export async function openApp(env: Record<string, string> = {}): Promise<Session> {
  const box = makeSandbox()
  const app = await launch(box, [], env)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
  return { box, app, page }
}

export async function closeApp(session: Session | undefined): Promise<void> {
  if (!session) return
  try {
    await session.app.close()
  } finally {
    fs.rmSync(session.box.root, { recursive: true, force: true })
  }
}
