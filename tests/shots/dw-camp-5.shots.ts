// CAMP-5 (spec/phases/design-wave-screens-b.md, "CAMP-5 — Translations tab"): 467, German with
// its rows (proposed, approved, typed over) and a failed job with Retry. A campaign in English
// and German at two sizes; the fake text provider proposes the German texts. The built app's
// fake provider cannot be told to fail, so the picture's failed job is drawn by wrapping the main
// process's query handler in this file only: translation.forCampaign gains one failed job and
// job.get answers for it. No app code changes. Fake providers only; nothing is paid and nothing
// leaves the machine. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as l from '../e2e/localize-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Lights Tea'
const FAILED = 'shot-failed-job'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

type Row = { layerId: string; language: string; status: string | null; copyRev: number }
type Read = { rows: Row[] }

async function setUp(page: Page) {
  await screens.createProject(page, 'Harbour Lights')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'DE',
      audience: 'Walkers on a cold harbour evening',
      message: 'Warm tea by the water',
      callToAction: 'Take a cup',
      subjects: [{ name: 'Cup' }],
    },
    subjectMap: [{ subjectId: 'cup', create: true }],
    languages: ['en', 'de'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const first = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  const directionId = first.directions[0]!.id
  await command(page, 'variant.fanOut', {
    projectId,
    directionId,
    sizes: ['1080x1920'],
    languages: ['de'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
  return { projectId, campaignId, directionId }
}

async function germanRows(page: Page, projectId: string, campaignId: string): Promise<Row[]> {
  const read = (await query(page, 'translation.forCampaign', { projectId, campaignId })) as Read
  return read.rows.filter((row) => row.language === 'de')
}

// Wraps the main process's query handler: one failed German job for the picture.
async function drawFailedJob(app: ElectronApplication, directionId: string) {
  await app.evaluate(
    ({ ipcMain }, given) => {
      type Handler = (event: unknown, name: string, input: unknown) => Promise<unknown>
      const channel = 'adman:query'
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
        ._invokeHandlers
      const original = handlers.get(channel)!
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async (event, name: string, input: { jobId?: string }) => {
        if (name === 'job.get' && input.jobId === given.jobId) {
          const at = '2026-11-21T09:00:00.000Z'
          const data = {
            id: given.jobId,
            kind: 'translation',
            status: 'failed',
            campaignId: null,
            variantId: null,
            layerId: null,
            slot: null,
            provider: 'fake',
            model: null,
            request: {},
            remoteJobId: null,
            result: null,
            errorKind: 'quota',
            progress: null,
            paidCalls: 0,
            seenAt: null,
            startedBy: 'user',
            errorReason: null,
            createdAt: at,
            updatedAt: at,
          }
          return { ok: true, data }
        }
        const reply = (await original(event, name, input)) as {
          ok: boolean
          data: { jobs: unknown[] } | null
        }
        if (name === 'translation.forCampaign' && reply.ok && reply.data !== null) {
          const job = {
            directionId: given.directionId,
            language: 'de',
            jobId: given.jobId,
            status: 'failed',
            errorKind: 'quota',
          }
          return { ...reply, data: { ...reply.data, jobs: [...reply.data.jobs, job] } }
        }
        return reply
      })
    },
    { jobId: FAILED, directionId },
  )
}

test('467 German with its rows and a failed job', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await l.chooseFakeText(page)
  const { projectId, campaignId, directionId } = await setUp(page)
  await expect
    .poll(async () => (await germanRows(page, projectId, campaignId)).map((r) => r.status), {
      timeout: 60_000,
    })
    .not.toContain('missing')

  // One row approved, one typed over by the user; the rest stay proposed.
  const rows = await germanRows(page, projectId, campaignId)
  const [approve, typed] = rows
  await command(page, 'translation.approve', {
    projectId,
    layers: [{ layerId: approve!.layerId, copyRev: approve!.copyRev }],
  })
  await command(page, 'translation.set', {
    projectId,
    layerId: typed!.layerId,
    text: 'Warmer Tee am Wasser',
    applyToSameLanguage: false,
  })
  await drawFailedJob(app, directionId)

  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  await showCampaignView(page, 'Translations')
  const german = l.group(page, 'German')
  await expect(german.getByText(/^Failed: /)).toBeVisible()
  await expect(german.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(l.rows(page, 'German')).toHaveCount(rows.length)
  await expect(german.locator('img')).toHaveCount(rows.length, { timeout: 30_000 })
  await page.mouse.move(0, 0)
  await shot(page, '467-translations-german-failed-job')
})
