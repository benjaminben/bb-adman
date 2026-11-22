// P4-19: "Cut out the subject…" in a picture layer's fields. The campaign comes from the S2-16
// brief; a picture layer "Subject" is added with an orange disc picture, and the background
// gets a plain blue picture (the background colour field is not built yet, LK-5). The button (100), its run dialog (101), and the fake
// provider's cut-out set on the layer over the blue (102). Earlier options (P4-18) is not in
// this branch, so the shots script sets the layer's picture through window.api for 102.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

type Layer = { id: string; type: string; name: string }
type Ids = { projectId: string; variantId: string; background: Layer }

// A 600 by 600 PNG: a warm orange disc on a pale sand ground, or (plain) all blue.
async function makePicture(app: ElectronApplication, file: string, plain: boolean): Promise<void> {
  const png = await app.evaluate(({ nativeImage }, blue) => {
    const size = 600
    const pixels = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const inside = (x - 300) ** 2 + (y - 300) ** 2 < 200 ** 2
        const [r, g, b] = blue ? [31, 111, 178] : inside ? [235, 130, 40] : [240, 228, 200]
        const i = (y * size + x) * 4
        pixels[i] = b
        pixels[i + 1] = g
        pixels[i + 2] = r
        pixels[i + 3] = 255
      }
    }
    return nativeImage
      .createFromBitmap(pixels, { width: size, height: size })
      .toPNG()
      .toString('base64')
  }, plain)
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
}

async function campaignFromBrief(app: ElectronApplication, page: Page): Promise<Ids> {
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'New campaign' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const got = (await query(page, 'variant.get', { projectId, variantId })) as { layers: Layer[] }
  const background = got.layers.find((l) => l.type === 'background')!
  return { projectId, variantId, background }
}

// The brief's variant has no picture layer, so one named "Subject" is added with the disc.
async function addPictureLayer(page: Page, ids: Ids, assetId: string): Promise<Layer> {
  const values = { name: 'Subject', source: { assetId } }
  await command(page, 'layer.create', {
    projectId: ids.projectId,
    variantId: ids.variantId,
    type: 'image',
    values,
  })
  const got = (await query(page, 'variant.get', ids)) as { layers: Layer[] }
  return got.layers.find((l) => l.name === 'Subject')!
}

async function setLayer(page: Page, projectId: string, layerId: string, patch: object) {
  await command(page, 'layer.update', { projectId, layerId, patch })
}

test('Cut out the subject of a picture layer with the fake provider', async () => {
  session = await openApp()
  const { app, page, box } = session
  const ids = await campaignFromBrief(app, page)
  const disc = path.join(box.root, 'orange-disc.png')
  const blue = path.join(box.root, 'blue.png')
  await makePicture(app, disc, false)
  await makePicture(app, blue, true)
  const { assetIds } = (await command(page, 'asset.import', {
    projectId: ids.projectId,
    paths: [disc, blue],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const picture = await addPictureLayer(page, ids, assetIds[0]!)
  await setLayer(page, ids.projectId, ids.background.id, { source: { assetId: assetIds[1] } })

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${picture.name}`) }).click()
  const fields = page.getByRole('group', { name: 'Picture' })
  const button = fields.getByRole('button', { name: 'Cut out the subject…' })
  await expect(button).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '100-cut-out-button')

  await button.click()
  const run = page.getByRole('dialog', { name: 'Cut out the subject' })
  await expect(run.getByRole('radio', { name: 'Fake provider' })).toBeChecked()
  await page.waitForTimeout(300)
  await shot(page, '101-cut-out-run-dialog')

  await run.getByRole('button', { name: 'Cut out' }).click()
  await expect(run).toBeHidden()
  await expect(fields.getByText('Done. The cut-out is under Earlier options.')).toBeVisible({
    timeout: 20_000,
  })
  const jobs = (await query(page, 'job.list', {
    projectId: ids.projectId,
    layerId: picture.id,
  })) as unknown as { kind: string; result: { assetIds: string[] } | null }[]
  const made = jobs.find((j) => j.kind === 'cutout')!.result!.assetIds[0]!
  await setLayer(page, ids.projectId, picture.id, { source: { assetId: made } })
  await page.waitForTimeout(800)
  await shot(page, '102-cut-out-over-colour')
})
