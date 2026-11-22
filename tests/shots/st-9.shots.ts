// ST-9: AI in the editor and the run dialog. The campaign comes from the S2-16 brief; one
// reference picture of the variant's subject is imported. The fake provider makes two pictures,
// so the generate fields (prompt in the reading face) show the earlier options row with one in
// use (194); then the run dialog from "Generate…" shows its bands, the provider rows with Google
// Gemini chosen and the paid count badge (193). Only the fake provider runs.
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

type Ids = { projectId: string; subjectId: string | undefined; background: string }

// A 600 by 600 PNG: a warm orange disc on a pale sand ground.
async function discPicture(app: ElectronApplication, file: string): Promise<void> {
  const png = await app.evaluate(({ nativeImage }) => {
    const size = 600
    const pixels = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const inside = (x - 300) ** 2 + (y - 300) ** 2 < 200 ** 2
        const [r, g, b] = inside ? [235, 130, 40] : [240, 228, 200]
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
  })
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
}

async function campaignFromBrief(app: ElectronApplication, page: Page): Promise<Ids> {
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
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
    variants: { id: string; subjectIds: string[] }[]
  }
  const variant = campaign.variants[0]!
  const got = (await query(page, 'variant.get', { projectId, variantId: variant.id })) as {
    layers: { id: string; type: string; name: string }[]
  }
  const background = got.layers.find((l) => l.type === 'background')!.name
  return { projectId, subjectId: variant.subjectIds[0], background }
}

test('The generate fields with earlier options, then the run dialog', async () => {
  session = await openApp()
  const { app, page, box } = session
  const ids = await campaignFromBrief(app, page)
  const file = path.join(box.root, 'orange-disc.png')
  await discPicture(app, file)
  await command(page, 'asset.import', {
    projectId: ids.projectId,
    paths: [file],
    library: 'reference',
    copy: false,
    ...(ids.subjectId === undefined ? {} : { subjectId: ids.subjectId }),
  })
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${ids.background}`) }).click()
  const section = page.getByRole('group', { name: 'Generate' })
  await expect(section.getByText(/^(\d+|None) chosen$/)).toBeVisible()

  await section.getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await run.getByRole('spinbutton', { name: 'Pictures' }).fill('2')
  await run.getByRole('button', { name: 'Generate' }).click()
  await expect(run).toBeHidden()
  await expect(section.getByText('Done. Choose one under Earlier options.')).toBeVisible({
    timeout: 20_000,
  })
  await section.getByRole('button', { name: /^Use option 1 from / }).click()
  await expect(section.getByText('In use')).toBeVisible()
  await section.getByRole('textbox', { name: 'Prompt' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '194-generate-fields')

  await section.getByRole('button', { name: 'Generate…' }).click()
  await expect(run.getByRole('radio', { name: 'Google Gemini' })).toBeChecked()
  await expect(run.getByText(/^Paid generations for this campaign so far:/)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '193-run-dialog')
})
