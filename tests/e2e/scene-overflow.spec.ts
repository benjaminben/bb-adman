// spec/scene.md "Settling and the overflow measurement" [P3-8, FR-098, FR-249]: a draw by the
// render service measures each text layer and reports overflow; size and letter spacing count.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, FONT_FILE, projectWithFont, query, renderPng } from './render-helpers'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

type Ids = { projectId: string; variantId: string }

// Draws the variant, then waits for the stored overflow of the layer to be the one expected.
async function drawAndExpect(page: Page, ids: Ids, layerId: string, overflow: boolean) {
  await renderPng(page, { ...ids, maxDimension: 300 })
  await expect
    .poll(async () => {
      const { layers } = await query(page, 'variant.get', ids)
      return (layers as { id: string; overflow: boolean }[]).find((l) => l.id === layerId)?.overflow
    })
    .toBe(overflow)
}

test('a text layer overflows by size and by letter spacing, and stops when made smaller', async () => {
  const font = path.join(box.root, 'brand.woff2')
  fs.copyFileSync(FONT_FILE, font)
  const app = await launch(box)
  const page = await app.firstWindow()
  const { projectId, variantId } = await projectWithFont(page, box.projects, font)
  const ids = { projectId, variantId }
  const style = (values: object) => ({ style: values })
  const { layerId } = await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'text',
    values: {
      copy: 'Summer',
      geometry: { x: 100, y: 100, width: 200, height: 60, rotation: 0 },
      style: { fontAssetId: null, fontSize: 32, lineHeight: 1.2, letterSpacing: 0 },
    },
  })
  const update = (patch: object) => command(page, 'layer.update', { projectId, layerId, patch })

  await drawAndExpect(page, ids, layerId as string, false)
  await update(style({ fontSize: 120 }))
  await drawAndExpect(page, ids, layerId as string, true)
  await update(style({ fontSize: 32 }))
  await drawAndExpect(page, ids, layerId as string, false)
  await update(style({ letterSpacing: 1 }))
  await drawAndExpect(page, ids, layerId as string, true)
  await update(style({ letterSpacing: 0 }))
  await drawAndExpect(page, ids, layerId as string, false)
  await app.close()
})

// LK-2: the text-box-overflow-bottom case. Bottom-aligned text drawn past the top of its box is
// flagged (the text element is measured, not the box); the same text in a box tall enough is not.
test('bottom-aligned text past the top of its box is flagged, and not when the box is tall enough', async () => {
  const font = path.join(box.root, 'brand.woff2')
  fs.copyFileSync(FONT_FILE, font)
  const app = await launch(box)
  const page = await app.firstWindow()
  const { projectId, variantId } = await projectWithFont(page, box.projects, font)
  const ids = { projectId, variantId }
  const geometry = (height: number) => ({ x: 50, y: 50, width: 200, height, rotation: 0 })
  const { layerId } = await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'text',
    values: {
      copy: 'This headline is far too long for its box',
      geometry: geometry(60),
      style: { fontAssetId: null, fontSize: 32, verticalAlign: 'bottom', boxColor: '#2850DC' },
    },
  })

  await drawAndExpect(page, ids, layerId as string, true)
  await command(page, 'layer.update', { projectId, layerId, patch: { geometry: geometry(240) } })
  await drawAndExpect(page, ids, layerId as string, false)
  await app.close()
})
