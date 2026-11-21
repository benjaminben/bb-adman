// S2-5: a failed ComfyUI run in the run row, against the stand-in on 127.0.0.1. Three states:
// a server that lacks the workflow's models (the list), a run that ran out of memory with the
// server's message opened, and a server that does not answer ("Open Settings").
import { test, expect, type Page } from '@playwright/test'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import * as screens from '../e2e/screens'
import { nthSentId, serveNeedsFromApp } from '../e2e/stand-in-runs'
import { closeApp, openApp, shot, type Session } from './shot'

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

// What a real server's history holds for a run that ran out of graphics memory.
function outOfMemory(server: StandIn, id: string): void {
  const error = {
    node_type: 'KSampler',
    exception_type: 'torch.OutOfMemoryError',
    exception_message:
      'Allocation on device 0 would exceed allowed memory. (out of memory)\n' +
      'Currently allocated: 22.81 GiB. Requested: 1.50 GiB.',
  }
  server.reply(`GET /history/${id}`, {
    json: {
      [id]: {
        status: { status_str: 'error', completed: false, messages: [['execution_error', error]] },
        outputs: {},
      },
    },
  })
}

// The built app with the stand-in's address saved, on a campaign set for one ComfyUI picture.
async function campaignOnStandIn(): Promise<{ page: Page; server: StandIn }> {
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  stand = await startComfyStandIn()
  const { app, page } = session
  await serveNeedsFromApp(page, stand)
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
  return { page, server: stand }
}

// The app checks a server once per address, so this state has its own app and stand-in.
test('A ComfyUI run on a server that lacks the models', async () => {
  const { page, server } = await campaignOnStandIn()
  for (const folder of ['diffusion_models', 'text_encoders', 'vae', 'loras']) {
    server.reply(`GET /models/${folder}`, { json: [] })
  }
  await screens.generate(page)
  const list = screens.runRow(page).getByRole('list', { name: 'What the server is missing' })
  await expect(list).toBeVisible({ timeout: 15_000 })
  await shot(page, '01-run-failure-missing-items')
})

test("A ComfyUI run out of memory, with the server's message, then no answer", async () => {
  const { page, server } = await campaignOnStandIn()
  await screens.generate(page)
  outOfMemory(server, await nthSentId(server, 1))
  const failed = screens.runRow(page)
  await expect(failed).toContainText('ran out of memory', { timeout: 15_000 })
  await failed.getByRole('button', { name: "Show the server's message" }).click()
  await expect(failed.getByText(/Allocation on device 0/)).toBeVisible()
  await shot(page, '02-run-failure-server-message')

  server.reply('*', { vanish: true })
  await screens.generate(page)
  const settings = screens.runRow(page).getByRole('button', { name: 'Open Settings' })
  await expect(settings).toBeVisible({ timeout: 30_000 })
  await shot(page, '03-run-failure-no-answer')
})
