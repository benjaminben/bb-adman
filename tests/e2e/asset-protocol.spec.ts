import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// A real 1 by 1 PNG, so the picture element can decode it.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

type Reply = { ok: boolean; data: Record<string, unknown> }

async function command(page: Page, name: string, input: Record<string, unknown>) {
  const reply = await page.evaluate(
    ([n, i]) =>
      (
        window as unknown as { api: { command: (n: string, i: unknown) => Promise<unknown> } }
      ).api.command(n as string, i),
    [name, input] as const,
  )
  expect((reply as Reply).ok).toBe(true)
  return (reply as Reply).data
}

async function importInto(page: Page, name: string, file: string) {
  const { projectId } = await command(page, 'project.create', { name, location: box.projects })
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })
  return { projectId: projectId as string, assetId: (assetIds as string[])[0] as string }
}

// Whether a picture element pointed at the address loads it.
function loads(page: Page, src: string): Promise<boolean> {
  return page.evaluate(
    (s) =>
      new Promise<boolean>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img.naturalWidth === 1)
        img.onerror = () => resolve(false)
        img.src = s
      }),
    src,
  )
}

test('adman-asset:// serves an open project picture and nothing else [SPEC 14, A2-2]', async () => {
  const file = path.join(box.root, 'dot.png')
  fs.writeFileSync(file, Buffer.from(PNG_BASE64, 'base64'))
  const app = await launch(box)
  const page = await app.firstWindow()

  const open = await importInto(page, 'Alpha', file)
  const closed = await importInto(page, 'Beta', file)
  await command(page, 'project.close', { projectId: closed.projectId })

  expect(await loads(page, `adman-asset://${open.projectId}/${open.assetId}`)).toBe(true)
  const unknown = '01JD0000000000000000000009'
  expect(await loads(page, `adman-asset://${open.projectId}/${unknown}`)).toBe(false)
  expect(await loads(page, `adman-asset://${closed.projectId}/${closed.assetId}`)).toBe(false)
  await app.close()
})
