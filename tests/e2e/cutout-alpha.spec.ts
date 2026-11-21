// P4-11 (spec/ai-jobs.md "See-through pixels through toPng"): in the built app, a fake cut-out
// run goes through Electron's real toPng and ends as a PNG with alpha (colour type 6): a
// corner pixel fully see-through, the centre fully solid. Read back with nativeImage.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

type Reply = { ok: boolean; data?: Record<string, unknown>; error?: unknown }
type Bridge = { api: Record<'command' | 'query', (n: string, i: unknown) => Promise<unknown>> }

async function call(kind: 'command' | 'query', name: string, input: Record<string, unknown>) {
  const reply = (await page.evaluate(
    ([k, n, i]) => (window as unknown as Bridge).api[k](n, i),
    [kind, name, input] as const,
  )) as Reply
  expect(reply.ok, JSON.stringify(reply.error)).toBe(true)
  return reply.data as Record<string, unknown>
}

// A 64 by 48 picture made by Electron itself, opaque everywhere.
async function sourcePicture(): Promise<string> {
  const base64 = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [64, 48]
    const data = Buffer.alloc(width * height * 4, 200)
    return nativeImage.createFromBitmap(data, { width, height }).toPNG().toString('base64')
  })
  const file = path.join(box.root, 'source.png')
  fs.writeFileSync(file, Buffer.from(base64, 'base64'))
  return file
}

async function backgroundLayer(projectId: string) {
  const campaign = await call('command', 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Cut',
      region: 'US',
      audience: 'All',
      message: 'Hi',
      subjects: [{ name: 'Can' }],
    },
    subjectMap: [{ subjectId: 'can', create: true }],
    languages: ['en'],
    sizes: [{ label: '1x1', width: 1080, height: 1080 }],
    templateId: 'starter',
  })
  const got = await call('query', 'campaign.get', { projectId, campaignId: campaign.campaignId })
  const [variant] = got.variants as Array<{ id: string }>
  const v = await call('query', 'variant.get', { projectId, variantId: variant?.id })
  const layers = v.layers as Array<{ id: string; type: string }>
  const layer = layers.find((l) => l.type === 'background')
  return { variantId: variant?.id ?? '', layerId: layer?.id ?? '' }
}

function findFile(dir: string, name: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return full
    if (entry.isDirectory()) {
      const found = findFile(full, name)
      if (found) return found
    }
  }
  return null
}

test('A fake cut-out ends as a PNG with alpha through the real toPng', async () => {
  const { projectId } = await call('command', 'project.create', {
    name: 'Cut-out',
    location: box.projects,
  })
  const imported = await call('command', 'asset.import', {
    projectId,
    paths: [await sourcePicture()],
    library: 'asset',
    copy: false,
  })
  const [assetId] = imported.assetIds as string[]
  const { variantId, layerId } = await backgroundLayer(projectId as string)
  await call('command', 'layer.update', {
    projectId,
    layerId,
    patch: { source: { assetId } },
  })
  const started = await call('command', 'generation.cutOut', {
    projectId,
    variantId,
    layerId,
    provider: 'fake',
  })
  const job = { projectId, jobId: started.jobId }
  await expect
    .poll(async () => ((await call('query', 'job.get', job)) as { status?: string }).status)
    .toBe('succeeded')
  const row = (await call('query', 'job.get', job)) as { result: { assetIds: string[] } }
  const file = findFile(box.root, `${row.result.assetIds[0]}.png`)
  expect(file).not.toBeNull()
  const bytes = fs.readFileSync(file ?? '')
  expect(bytes[25]).toBe(6)

  const alpha = await app.evaluate(({ nativeImage }, base64) => {
    const image = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
    const { width, height } = image.getSize()
    const bitmap = image.toBitmap()
    const at = (x: number, y: number) => bitmap[(y * width + x) * 4 + 3]
    return { width, height, corner: at(0, 0), centre: at(width >> 1, height >> 1) }
  }, bytes.toString('base64'))
  expect(alpha).toEqual({ width: 64, height: 48, corner: 0, centre: 255 })
})
