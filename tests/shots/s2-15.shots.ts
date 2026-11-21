// The slot view (S2-15) on the campaign page: first with every slot empty, then after a
// fake-provider run whose pictures are tied to the campaign's subject, so the subject picture
// slot lists them. No screen ties a picture to a subject yet, so this file sends asset.update
// itself through the window's api, as the screen would.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const NAMES = ['Citrus can on a picnic table.png', 'Citrus can by the pool.png', 'Can in ice.png']

type Reply = { ok: boolean; data: unknown }
type Api = {
  query(n: string, i?: unknown): Promise<Reply>
  command(n: string, i: unknown): Promise<Reply>
}

// Ties every generated picture to the campaign's first subject and gives each a name.
async function tieToSubject(page: Page): Promise<void> {
  await page.evaluate(async (names) => {
    const api = (window as unknown as { api: Api }).api
    const open = (await api.query('project.listOpen')).data as Array<{ id: string }>
    const projectId = open[0]!.id
    const project = (await api.query('project.get', { projectId })).data as {
      subjects: Array<{ id: string }>
    }
    const assets = (await api.query('asset.list', { projectId, library: 'asset', kind: 'image' }))
      .data as Array<{ id: string }>
    for (const [i, asset] of assets.entries()) {
      await api.command('asset.update', {
        projectId,
        assetId: asset.id,
        subjectId: project.subjects[0]!.id,
        displayName: names[i % names.length],
      })
    }
  }, NAMES)
}

test('The slot view, empty and with candidate pictures', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const slots = page.getByRole('region', { name: 'Slots' })
  await expect(slots.getByRole('list', { name: 'Slots of the master' })).toBeVisible()
  await shot(page, '01-slot-view-empty')

  await screens.chooseProvider(page, 'Fake provider')
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 3)
  await screens.generate(page)
  await expect(screens.runRow(page).getByRole('img').first()).toBeVisible({ timeout: 30_000 })
  await tieToSubject(page)
  await expect(slots.getByText('Pictures that could go here:')).toBeVisible()
  await expect(slots.getByRole('img')).toHaveCount(3)
  await shot(page, '02-slot-view-candidates')
})
