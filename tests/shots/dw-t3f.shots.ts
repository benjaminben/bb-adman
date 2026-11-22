// T3f (spec/phases/design-wave.md): every icon of the set in one picture, each at 24px and at
// 16px with its name under it, on the app's page ground in the app's own stroke, so the set can
// be judged by eye. The page is the built app's, emptied and drawn over (as r2p-11 does).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { ICON_PATHS } from '../../src/renderer/ui/icon/icon-paths'
import { closeApp, openApp, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Shape = readonly [string, Readonly<Record<string, string>>]

function svgMarkup(shapes: readonly Shape[], size: number): string {
  const inner = shapes
    .map(([tag, attrs]) => {
      const list = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`)
      return `<${tag} ${list.join(' ')}/>`
    })
    .join('')
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" style="stroke-width: var(--icon-stroke)" stroke-linecap="round" ` +
    `stroke-linejoin="round">${inner}</svg>`
  )
}

async function drawSet(page: Page): Promise<void> {
  const cells = Object.entries(ICON_PATHS).map(([name, shapes]) => ({
    name,
    large: svgMarkup(shapes, 24),
    small: svgMarkup(shapes, 16),
  }))
  await page.evaluate((list) => {
    document.body.replaceChildren()
    Object.assign(document.body.style, { background: 'var(--color-page)', margin: '0' })
    const grid = document.createElement('div')
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 120px)',
      gap: '20px 8px',
      padding: '24px',
      color: 'var(--color-text)',
      font: '12px var(--font-body)',
    })
    for (const cell of list) {
      const box = document.createElement('div')
      Object.assign(box.style, { display: 'grid', justifyItems: 'center', gap: '6px' })
      const icons = document.createElement('div')
      Object.assign(icons.style, { display: 'flex', alignItems: 'end', gap: '12px' })
      icons.innerHTML = cell.large + cell.small
      const label = document.createElement('div')
      label.textContent = cell.name
      box.append(icons, label)
      grid.append(box)
    }
    document.body.append(grid)
  }, cells)
}

test('Every icon of the set at 24px and at 16px', async () => {
  session = await openApp()
  const { page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await drawSet(page)
  await expect(page.locator('svg')).toHaveCount(Object.keys(ICON_PATHS).length * 2)
  await page.setViewportSize({ width: 1340, height: 640 })
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', '405-icons-all.png'), fullPage: true })
})
