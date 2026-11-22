// T3a, T3b and T3e (spec/phases/design-wave.md): the Section, StatusMark, InfoTip, SubPage,
// SideList and PanelHead parts in their states, on the app's page ground. No screen uses them
// yet, so the scenes (dw-t3-parts-a-scenes.tsx) are bundled here with Vite and drawn over the
// built app's emptied page, which brings the app's tokens and base styles (as dw-t3f does).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import react from '@vitejs/plugin-react'
import { build, type Rollup } from 'vite'
import { srcAlias } from '../../path-alias.config'
import type { SceneName } from './dw-t3-parts-a-scenes'
import { closeApp, openApp, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Bundle = { code: string; css: string }

// One script that defines `PartsScenes.show(name)`, and the parts' CSS.
async function bundleScenes(): Promise<Bundle> {
  const built = (await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: srcAlias },
    plugins: [react()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry: path.resolve('tests/shots/dw-t3-parts-a-scenes.tsx'),
        formats: ['iife'],
        name: 'PartsScenes',
      },
    },
  })) as Rollup.RollupOutput[]
  const output = built.flatMap((b) => b.output)
  const code = output.flatMap((o) => (o.type === 'chunk' ? [o.code] : [])).join('\n')
  const css = output
    .flatMap((o) => (o.type === 'asset' && o.fileName.endsWith('.css') ? [String(o.source)] : []))
    .join('\n')
  return { code, css }
}

async function load(page: Page, bundle: Bundle): Promise<void> {
  // A string given to evaluate runs over the debugging channel, outside the page's script policy.
  await page.evaluate(`${bundle.code}\nwindow.PartsScenes = PartsScenes`)
  await page.evaluate((css) => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
  }, bundle.css)
}

async function show(page: Page, name: SceneName): Promise<void> {
  await page.evaluate((scene) => {
    const scenes = (window as unknown as { PartsScenes: { show: (n: string) => void } }).PartsScenes
    scenes.show(scene)
  }, name)
}

async function save(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', `${name}.png`) })
}

test('The Section, StatusMark, InfoTip, SubPage, SideList and PanelHead parts', async () => {
  const bundle = await bundleScenes()
  session = await openApp()
  const { page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await load(page, bundle)
  await page.setViewportSize({ width: 1000, height: 520 })

  await show(page, 'section')
  await expect(page.getByRole('button', { name: 'Cloud storage', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Cloud storage', exact: true }).first().focus()
  await page.keyboard.press('Tab')
  await save(page, '406-section')

  await show(page, 'marks')
  await expect(page.getByText('Clickable')).toBeVisible()
  await page.setViewportSize({ width: 620, height: 560 })
  await page.getByRole('button', { name: 'Not set', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await save(page, '407-status-marks')

  await show(page, 'tip')
  await page.setViewportSize({ width: 560, height: 360 })
  const tip = page.getByRole('button', { name: 'About region' })
  await tip.focus()
  await page.keyboard.press('Enter')
  await expect(tip).toHaveAttribute('aria-expanded', 'true')
  await save(page, '408-info-tip-open')

  await show(page, 'page')
  await page.setViewportSize({ width: 1200, height: 500 })
  await expect(page.getByRole('heading', { name: 'Server folders' })).toBeFocused()
  await save(page, '409-sub-page-side-list')
})
