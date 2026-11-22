// T3c and T4 (spec/phases/design-wave.md): the new shared parts drawn outside any screen, on
// the app's page ground with the app's own tokens and base styles. No screen uses the parts
// yet, so the built app holds none of their code: a small scene module is bundled here with
// Vite (made-up names only) and drawn over the emptied page, as dw-t3f.shots.ts does.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { closeApp, openApp, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const SCENES = path.resolve('tests/shots/.dw-t3-parts-b-scenes.tsx')

const SOURCE = `
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ObjectRow } from '@/renderer/ui/object-row'
import { MoreMenu } from '@/renderer/ui/more-menu'
import { EmptyState } from '@/renderer/ui/empty-state'
import { DialogFrame, dialogStyles } from '@/renderer/ui/dialog-frame'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { MoneyLine } from '@/renderer/ui/money-line'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'

const small = { width: 'var(--control-height-small)', minHeight: 'var(--control-height-small)', padding: 0 }

function Tool(props) {
  return (
    <button type="button" className={layout.quiet} style={small} aria-label={props.name}
      title={props.name} aria-pressed={props.pressed}>
      <Icon name={props.icon} size="small" />
    </button>
  )
}

function Thumb(props) {
  return (
    <span style={{ display: 'block', width: 'var(--layer-thumb)', height: 'var(--layer-thumb)',
      borderRadius: 'var(--radius-inner)', background: props.ground }} />
  )
}

const ITEMS = [
  { id: 'rename', label: 'Rename…', icon: 'pencil', onChoose() {} },
  { id: 'copy', label: 'Duplicate', icon: 'copy', disabled: true,
    reason: 'Unlock the layer first', onChoose() {} },
  { id: 'delete', label: 'Delete', icon: 'trash', danger: true, onChoose() {} },
]

function row(name, extra) {
  return (
    <ObjectRow name={name} label={name} {...extra}
      stateActions={<><Tool name={'Hide ' + name} icon="eye" /><Tool name={'Lock ' + name} icon="lock" /></>}
      actions={<Tool name={'Rename ' + name} icon="pencil" />}
      more={<MoreMenu label={name} items={ITEMS} />} />
  )
}

function Rows() {
  return (
    <div style={{ width: '360px', display: 'grid', gap: 'var(--space-1)', padding: 'var(--space-3)',
      background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
      {row('Headline', { thumb: <Thumb ground="var(--color-accent-soft)" /> })}
      {row('Spring offer banner', { thumb: <Thumb ground="var(--color-info-bg)" />,
        meta: '1080 × 1080 · 3 variants' })}
      {row('Hero picture', { thumb: <Thumb ground="var(--color-ok-bg)" />, selected: true,
        marks: <span style={{ color: 'var(--color-warn)' }} title="Paid"><Icon name="coin" size="small" /></span> })}
      {row('Old tagline', { thumb: <Thumb ground="var(--color-warn-bg)" />, muted: true })}
      {row('Logo lockup with a very long name that does not fit', { thumb: <Thumb ground="var(--canvas-backdrop)" />,
        title: 'Logo lockup with a very long name that does not fit' })}
    </div>
  )
}

function Empty() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)', width: '420px' }}>
      <EmptyState icon="folder" words="No campaigns yet"
        action={{ label: 'New campaign', primary: true, onClick() {} }} />
      <EmptyState icon="key" words="No keys" action={{ label: 'Add key', onClick() {} }} />
      <EmptyState icon="image" words="No pictures" />
    </div>
  )
}

function Run() {
  return (
    <DialogFrame open kind="run" title="Make pictures" warning="The current picture is replaced."
      describedBy="dw-cost" onClose={() => {}}
      footer={<><button type="button" className={layout.quiet}>Cancel</button>
        <button type="button" className={layout.primary}>Generate</button></>}>
      <DialogAlert tone="danger" action={{ label: 'Retry', onClick() {} }}>
        The provider refused the last request.
      </DialogAlert>
      <DialogAlert tone="busy">Checking the key</DialogAlert>
      <p style={{ margin: '0 0 var(--gap-field)' }}>Pictures: 4</p>
      <MoneyLine id="dw-cost">Paid: 4 pictures + 2 references → Fal Studio</MoneyLine>
    </DialogFrame>
  )
}

const GROUNDS = ['var(--color-accent-soft)', 'var(--color-info-bg)', 'var(--color-ok-bg)',
  'var(--color-warn-bg)', 'var(--canvas-backdrop)', 'var(--color-danger-bg)']

function Pick() {
  const [chosen, setChosen] = useState(1)
  return (
    <DialogFrame open kind="pick" title="Choose a layout" onClose={() => {}}
      footer={<><button type="button" className={layout.quiet}>Cancel</button>
        <button type="button" className={layout.primary}>Use</button></>}>
      <div className={dialogStyles.pickGrid}>
        {GROUNDS.map((ground, i) => (
          <button key={i} type="button" aria-pressed={i === chosen} aria-label={'Layout ' + (i + 1)}
            title={'Layout ' + (i + 1)} onClick={() => setChosen(i)}
            style={{ height: 'var(--thumbnail-tile)', padding: 0, background: ground }} />
        ))}
      </div>
    </DialogFrame>
  )
}

const SCENE = { rows: Rows, empty: Empty, run: Run, pick: Pick }

window.drawScene = (name) => {
  document.body.replaceChildren()
  Object.assign(document.body.style, { background: 'var(--color-page)', margin: '0' })
  const holder = document.createElement('div')
  Object.assign(holder.style, { padding: '32px' })
  document.body.append(holder)
  const Scene = SCENE[name]
  createRoot(holder).render(<Scene />)
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

test('ObjectRow, MoreMenu, EmptyState, the dialog kinds and the pick grid', async () => {
  const code = await bundle()
  session = await openApp()
  const { page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.setViewportSize({ width: 900, height: 520 })
  await load(page, code)

  await draw(page, 'rows')
  await page.getByRole('button', { name: 'More actions for Old tagline' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await save(page, '496-object-rows')

  await draw(page, 'empty')
  await expect(page.getByText('No campaigns yet')).toBeVisible()
  await save(page, '497-empty-state')

  await page.setViewportSize({ width: 900, height: 640 })
  await draw(page, 'run')
  await expect(page.getByRole('dialog', { name: 'Make pictures' })).toBeVisible()
  await save(page, '498-dialog-kinds')

  await draw(page, 'pick')
  await expect(page.getByRole('dialog', { name: 'Choose a layout' })).toBeVisible()
  await save(page, '499-pick-grid')
})
