// P8-19, from P8-4: pictures drawn by a real export. export.run is sent from window.api with a
// temporary output folder, the job is waited for and the PNG it wrote is read from disk. The
// transparent-hole scene matches its scene reference [REQ: FR-245]; the PNG carries no
// `generation` chunk [REQ: FR-068]; a variant wider than 2,048 (drawn in tiles and stitched)
// comes out at exactly its size. The reference is only read here, never written.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, makePng, query } from './render-helpers'
import { decodePng, differingShare, REFERENCE_DIR } from './reference-compare'
import { CASES, PICTURES, SIDE, type CaseAssets } from './scene-cases'
import { appWindow } from './publish-steps'
import { pngChunks } from '../fixtures/png-chunks'
import * as ex from './export-steps'
import { filesUnder } from './publish-steps'

let box: Sandbox
let app: ElectronApplication
let page: Page
let projectId: string

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await appWindow(app)
  const made = await command(page, 'project.create', { name: 'Export', location: box.projects })
  projectId = made.projectId as string
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// A campaign of one variant at the size given, its starter layers removed and the background
// left plain; gives the IDs.
async function plainVariant(name: string, width: number, height: number) {
  const { campaignId, variantId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: name,
      region: 'US',
      audience: 'All',
      message: 'Hello',
      subjects: [{ name }],
    },
    subjectMap: [{ subjectId: name.toLowerCase(), create: true }],
    languages: ['en'],
    sizes: [{ label: `${width}x${height}`, width, height }],
    templateId: 'starter',
  })) as { campaignId: string; variantId: string }
  const { layers } = await query(page, 'variant.get', { projectId, variantId })
  for (const layer of layers as { id: string; type: string }[]) {
    if (layer.type !== 'background') {
      await command(page, 'layer.delete', { projectId, layerId: layer.id })
      continue
    }
    const patch = { style: { shade: null } }
    await command(page, 'layer.update', { projectId, layerId: layer.id, patch })
  }
  const background = (layers as { id: string; type: string }[]).find(
    (l) => l.type === 'background',
  )!
  return { campaignId, variantId, backgroundId: background.id }
}

async function importPictures(names: (keyof typeof PICTURES)[]) {
  const paths: string[] = []
  for (const name of names) {
    const file = path.join(box.root, `${name}.png`)
    fs.writeFileSync(file, await makePng(app, PICTURES[name]))
    paths.push(file)
  }
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths,
    library: 'asset',
    copy: false,
  })
  return Object.fromEntries(names.map((n, i) => [n, (assetIds as string[])[i]]))
}

// The one PNG the export wrote under the folder.
function exportedPng(folder: string): Buffer {
  const pngs = filesUnder(folder).filter((f) => f.endsWith('.png'))
  expect(pngs).toHaveLength(1)
  return fs.readFileSync(path.join(folder, pngs[0]!))
}

test('the transparent-hole scene exported as PNG matches its reference [FR-245, FR-068]', async () => {
  test.setTimeout(120_000)
  const hole = CASES.find((c) => c.name === 'transparent-hole')!
  const assets = (await importPictures(['magenta', 'hole'])) as unknown as CaseAssets
  const { campaignId, variantId, backgroundId } = await plainVariant('Hole', SIDE, SIDE)
  await command(page, 'layer.update', {
    projectId,
    layerId: backgroundId,
    patch: hole.background!(assets),
  })
  for (const { type, values } of hole.layers!(assets)) {
    await command(page, 'layer.create', { projectId, variantId, type, values })
  }

  const folder = ex.outputFolder(box.root, 'hole export')
  const end = await ex.exportByApi(page, { projectId, campaignId }, [variantId], folder)
  expect(end.status).toBe('succeeded')
  expect(end.result).toMatchObject({ exported: 1, failed: 0 })

  const png = exportedPng(folder)
  // Fresh bytes: no generation details, and every chunk whole [FR-068].
  const chunks = pngChunks(png)
  expect(chunks.every((c) => c.crcOk)).toBe(true)
  expect(chunks.filter((c) => c.type === 'iTXt' || c.type === 'tEXt' || c.type === 'zTXt')).toEqual(
    [],
  )
  expect(png.includes(Buffer.from('generation', 'latin1'))).toBe(false)

  const reference = path.join(REFERENCE_DIR, 'transparent-hole.png')
  test.skip(!fs.existsSync(reference) && process.platform === 'win32', 'No Windows reference yet.')
  const drawn = await decodePng(app, png)
  const stored = await decodePng(app, fs.readFileSync(reference))
  const share = differingShare(drawn, stored)
  expect(share, `${(share * 100).toFixed(2)} % of the pixels differ`).toBeLessThanOrEqual(0.005)
})

test('a variant of 3,000 × 1,000 exports at exactly that size', async () => {
  test.setTimeout(120_000)
  const { bands } = await importPictures(['bands'])
  const { campaignId, variantId, backgroundId } = await plainVariant('Wide', 3000, 1000)
  const patch = { source: { assetId: bands } }
  await command(page, 'layer.update', { projectId, layerId: backgroundId, patch })

  const folder = ex.outputFolder(box.root, 'wide export')
  const end = await ex.exportByApi(page, { projectId, campaignId }, [variantId], folder)
  expect(end.status).toBe('succeeded')

  const png = exportedPng(folder)
  const header = pngChunks(png)[0]!
  expect(header.type).toBe('IHDR')
  expect([header.data.readUInt32BE(0), header.data.readUInt32BE(4)]).toEqual([3000, 1000])
  // The stitched picture is whole: either side of the tile seam at 2,048 holds the same band,
  // and the far corner is drawn, not left black.
  const drawn = await decodePng(app, png)
  const at = (x: number, y: number) => {
    const i = (y * drawn.width + x) * 4
    return [...drawn.pixels.subarray(i, i + 4)]
  }
  expect(at(2048, 500)).toEqual(at(2047, 500))
  expect(at(2047, 500)).not.toEqual([0, 0, 0, 255])
  expect(at(2999, 999)).not.toEqual([0, 0, 0, 255])
})
