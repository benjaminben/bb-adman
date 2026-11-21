// spec/security.md "The drop bridge" and spec/screens-campaign.md "Importing by dropping files"
// (S2-3, security class): the window gains window.drop.pathOf and nothing else.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
  fs.rmSync(box.root, { recursive: true, force: true })
})

test('window.drop has exactly the key pathOf', async () => {
  const keys = await page.evaluate(() => Object.keys(window.drop ?? {}).sort())
  expect(keys).toEqual(['pathOf'])
})

test('window.api still has exactly command, query and on', async () => {
  const keys = await page.evaluate(() => Object.keys(window.api).sort())
  expect(keys).toEqual(['command', 'on', 'query'])
})

test('pathOf of a File the page made gives an empty string', async () => {
  const answer = await page.evaluate(() => window.drop?.pathOf(new File(['x'], 'made.png')))
  expect(answer).toBe('')
})

test('pathOf of a value that is not a File gives an empty string and does not throw', async () => {
  const answers = await page.evaluate(() => {
    const pathOf = window.drop?.pathOf as (value: unknown) => unknown
    return [
      pathOf('/etc/hosts'),
      pathOf({ path: '/etc/hosts', name: 'hosts' }),
      pathOf(undefined),
      pathOf(new Blob(['x'])),
    ]
  })
  expect(answers).toEqual(['', '', '', ''])
})

test('pathOf of a file the system gave the page gives its full path', async () => {
  const file = path.join(box.root, 'dropped photo.png')
  fs.writeFileSync(file, 'not really a picture')
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'drop-bridge-check'
    input.hidden = true
    document.body.append(input)
  })
  await page.setInputFiles('#drop-bridge-check', file)
  const answer = await page.evaluate(() => {
    const input = document.getElementById('drop-bridge-check') as HTMLInputElement
    const picked = input.files?.[0]
    input.remove()
    return picked ? window.drop?.pathOf(picked) : 'no file'
  })
  expect(answer).toBe(file)
})

test('a drop event holding a page-made file leaves the page address unchanged', async () => {
  const before = page.url()
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'made.png', { type: 'image/png' }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      )
    }
  })
  await page.waitForTimeout(300)
  expect(page.url()).toBe(before)
  expect(await page.evaluate(() => location.href)).toBe(before)
})
