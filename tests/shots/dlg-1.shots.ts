// DLG-1 (spec/phases/design-wave-screens-b.md): the JobProgress part in its states, drawn
// outside any screen on the app's page ground with the app's own tokens and base styles. No
// screen uses the part yet, so a small scene module is bundled here with Vite (made-up words
// only) and drawn over the emptied page, as dw-t3-parts-b.shots.ts does.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { closeApp, openApp, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const SCENES = path.resolve('tests/shots/.dlg-1-scenes.tsx')

const SOURCE = `
import { createRoot } from 'react-dom/client'
import { JobProgress } from '@/renderer/ui/job-progress'

function State(props) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 'var(--type-meta-size)', color: 'var(--color-text-muted)' }}>
        {props.note}
      </span>
      {props.children}
    </div>
  )
}

function Jobs() {
  return (
    <div style={{ width: '480px', display: 'grid', gap: 'var(--space-6)', padding: 'var(--space-6)',
      background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
      <State note="Known value, can go on alone">
        <JobProgress label="Exporting" value={0.42}
          action={{ label: 'Run in background', onClick() {} }} />
      </State>
      <State note="Known count (read as 3 of 10)">
        <JobProgress label="Publishing" value={0.3} count={{ done: 3, total: 10 }}
          action={{ label: 'Stop publishing', onClick() {} }} />
      </State>
      <State note="No known value (still under reduce motion)">
        <JobProgress label="Packaging" value={null} action={{ label: 'Stop', onClick() {} }} />
      </State>
      <State note="Stop not available">
        <JobProgress label="Updating the gallery" value={0.95}
          action={{ label: 'Stop', onClick() {}, disabled: true }} />
      </State>
      <State note="No button">
        <JobProgress label="Exporting" value={1} />
      </State>
    </div>
  )
}

window.drawScene = () => {
  document.body.replaceChildren()
  Object.assign(document.body.style, { background: 'var(--color-page)', margin: '0' })
  const holder = document.createElement('div')
  Object.assign(holder.style, { padding: '32px' })
  document.body.append(holder)
  createRoot(holder).render(<Jobs />)
}
`

type Bundle = { js: string; css: string }

async function bundle(): Promise<Bundle> {
  const { build } = await import('vite')
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': path.resolve('src') } },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'dw-scenes',
        resolveId: (id: string) => (id === SCENES ? SCENES : null),
        load: (id: string) => (id === SCENES ? SOURCE : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: SCENES, formats: ['iife'], name: 'dwScenes', fileName: () => 'scenes.js' },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) =>
    'output' in r ? r.output : [],
  )
  const text = (file: (typeof outputs)[number]) =>
    file.type === 'chunk' ? file.code : String(file.source)
  const js = outputs.find((f) => f.fileName.endsWith('.js'))
  const css = outputs.filter((f) => f.fileName.endsWith('.css'))
  if (!js) throw new Error('the scenes did not bundle')
  return { js: text(js), css: css.map(text).join('\n') }
}

// The bundle goes in as a page script, and its CSS as a constructed sheet (the page's content
// security policy holds no inline script or style).
async function load(page: Page, code: Bundle): Promise<void> {
  await page.evaluate(code.js)
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }, code.css)
}

async function draw(page: Page, scene: string): Promise<void> {
  await page.evaluate((name) => {
    ;(window as unknown as { drawScene: (s: string) => void }).drawScene(name)
  }, scene)
}

async function save(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', `${name}.png`) })
}

test('JobProgress in its states', async () => {
  const code = await bundle()
  session = await openApp()
  const { page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.setViewportSize({ width: 640, height: 520 })
  await load(page, code)

  await draw(page, 'jobs')
  await expect(page.getByRole('progressbar', { name: 'Packaging' })).toBeVisible()
  await save(page, '492-job-progress')
})
