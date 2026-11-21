// P4-18: "Earlier options" under "Make pictures with AI" on the background layer. Two runs of
// the fake provider are listed, and one option chosen with Use reads "In use" (89). A run on
// the stand-in ComfyUI (127.0.0.1) that the server could not finish then shows its sentence
// and Retry (89b). No paid provider and no real ComfyUI server is reached.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { finishWithError, nthSentId, serveNeedsFromApp } from '../e2e/stand-in-runs'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined
let stand: StandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
    await stand?.close()
  } finally {
    session = undefined
    stand = undefined
  }
})

type Place = { projectId: string; variantId: string; layerId: string; name: string }

// The campaign from the S2-16 brief, and its first variant's background layer.
async function background(page: Page): Promise<Place> {
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
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string; name: string }[]
  }
  const layer = got.layers.find((l) => l.type === 'background')!
  return { projectId, variantId, layerId: layer.id, name: layer.name }
}

function run(page: Page, place: Place, provider: string, count: number) {
  const { projectId, variantId, layerId } = place
  const prompt = 'A sunlit alpine meadow, wide and calm'
  return command(page, 'generation.runImages', {
    ...{ projectId, variantId, layerId, prompt, referenceAssetIds: [], count, provider },
  })
}

async function finishedRuns(page: Page, place: Place): Promise<number> {
  const reply = (await query(page, 'job.earlierOptions', {
    projectId: place.projectId,
    layerId: place.layerId,
  })) as { job: { status: string } }[]
  return reply.filter((r) => r.job.status === 'succeeded').length
}

test('Earlier options of a picture layer', async () => {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await serveNeedsFromApp(page, stand)
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const place = await background(page)

  await run(page, place, 'fake', 2)
  await expect.poll(() => finishedRuns(page, place), { timeout: 20_000 }).toBe(1)
  await run(page, place, 'fake', 3)
  await expect.poll(() => finishedRuns(page, place), { timeout: 20_000 }).toBe(2)

  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${place.name}`) }).click()
  const section = page.getByRole('region', { name: 'Earlier options' })
  await section
    .getByRole('button', { name: /^Use option 2 from / })
    .first()
    .click()
  await expect(section.getByText('In use')).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '89-earlier-options')

  await run(page, place, 'comfyui', 1)
  finishWithError(stand, await nthSentId(stand, 1))
  await expect(section.getByText('Failed')).toBeVisible({ timeout: 20_000 })
  await expect(section.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '89b-earlier-options-failed')
})
