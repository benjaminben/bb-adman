// P10-3 (spec/phases/phase-10.md, A-234, stakeholder ruling): in the built app, an MCP client
// asks render_variant for a variant whose picture is linked from a folder outside the
// project's folder. The PNG it gets shows that picture where its layer is, and no path, file
// name or asset address reaches the reply or the log.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, makePng, query } from './render-helpers'
import { decodePng, type Bitmap } from './reference-compare'
import { toolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'

const SIDE = 400
// Blue, green, red, alpha: an 8 by 8 red picture.
const RED_BGRA = [40, 40, 220, 255]
const RED = { width: 8, height: 8, bgra: Array.from({ length: 64 }, () => RED_BGRA).flat() }

type Layer = { id: string; type: string }

let box: Sandbox
let app: ElectronApplication
let page: Page

test.afterEach(async () => {
  await app?.close()
  fs.rmSync(box.root, { recursive: true, force: true })
})

// A 400 by 400 variant: a plain background and the picture in a 200 by 200 box at 100, 100.
async function variantWith(projectId: string, assetId: string): Promise<string> {
  const { variantId } = await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Far picture',
      region: 'US',
      audience: 'All',
      message: 'Hello',
      subjects: [{ name: 'Can' }],
    },
    subjectMap: [{ subjectId: 'can', create: true }],
    languages: ['en'],
    sizes: [{ label: `${SIDE}x${SIDE}`, width: SIDE, height: SIDE }],
    templateId: 'starter',
  })
  const { layers } = await query(page, 'variant.get', { projectId, variantId })
  for (const layer of layers as Layer[]) {
    if (layer.type !== 'background') {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
      continue
    }
    const plain = { projectId, layerId: layer.id, patch: { style: { shade: null } } }
    await command(page, 'layer.update', plain)
  }
  await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'image',
    values: {
      source: { assetId },
      geometry: { x: 100, y: 100, width: 200, height: 200, rotation: 0, crop: null },
      style: { opacity: 1 },
    },
  })
  return variantId as string
}

const pixelAt = (b: Bitmap, x: number, y: number) => {
  const i = (y * b.width + x) * 4
  return [...b.pixels.subarray(i, i + 4)]
}

function logLines(): string[] {
  const dir = path.join(box.userData, 'logs')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap((n) => fs.readFileSync(path.join(dir, n), 'utf8').split('\n'))
}

const near = (got: number[], want: number[]) => got.every((v, i) => Math.abs(v - want[i]!) <= 8)

test('render_variant draws a linked picture from outside the project folder', async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = await query(page, 'mcp.getConnectInfo', {})
  const elsewhere = path.join(box.root, 'elsewhere-made-up')
  fs.mkdirSync(elsewhere)
  const far = path.join(elsewhere, 'far-away-made-up.png')
  fs.writeFileSync(far, await makePng(app, RED))
  const { projectId } = await command(page, 'project.create', {
    name: 'Agent picture',
    location: box.projects,
  })
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [far],
    library: 'asset',
    copy: false,
  })
  const variantId = await variantWith(projectId as string, (assetIds as string[])[0]!)

  const s = await toolSession(port, token as string)
  const linesBefore = new Set(logLines())
  const reply = await s.call('render_variant', {
    project_id: projectId,
    variant_id: variantId,
    max_dimension: SIDE,
  })
  const items = (reply.content ?? []) as Array<{ type: string; mimeType?: string; data?: string }>
  expect(reply.isError).toBeFalsy()
  expect(items.map((i) => [i.type, i.mimeType])).toEqual([['image', 'image/png']])
  const drawn = await decodePng(app, Buffer.from(items[0]!.data!, 'base64'))
  expect([drawn.width, drawn.height]).toEqual([SIDE, SIDE])
  // The picture's box shows the red picture; a corner shows the background, not red.
  expect(near(pixelAt(drawn, 200, 200), RED_BGRA), 'the centre is the picture').toBe(true)
  expect(near(pixelAt(drawn, 20, 20), RED_BGRA), 'a corner is the background').toBe(false)

  // The log lines the agent's call wrote.
  const newLines = logLines().filter((l) => !linesBefore.has(l))
  for (const text of [JSON.stringify(reply), newLines.join('\n')]) {
    for (const word of ['elsewhere-made-up', 'far-away-made-up', 'adman-asset:']) {
      expect(text.includes(word), word).toBe(false)
    }
  }
})
