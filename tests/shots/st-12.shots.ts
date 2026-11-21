// ST-12: the campaign page's run panels in the app style. A fake provider run of two pictures
// is done (a table row, its pictures on the soft ground); then Gemini is chosen and Generate
// shows the paid confirm line, an info notice. Nothing is sent: the shot is taken before
// Confirm, and Cancel closes the line. Only the fake provider runs.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('the run list, a done run and the paid confirm line', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Harbour Lemonade')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  await screens.chooseProvider(page, 'Fake provider')
  await screens.untickReferences(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 2)
  await screens.generate(page)
  const row = screens.runRow(page)
  await expect(row.getByText('Done')).toBeVisible({ timeout: 30_000 })
  const pictures = row.getByRole('img', { name: /^Result / })
  await expect(pictures).toHaveCount(2)
  for (const picture of await pictures.all()) {
    await expect
      .poll(() => picture.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0)
  }

  await screens.chooseProvider(page, 'Google Gemini')
  await screens.generate(page)
  const panel = screens.picturePanel(page)
  await expect(panel.getByText(/paid request/)).toBeVisible()
  await shot(page, '198-campaign-run-list')
  await panel.getByRole('button', { name: 'Cancel' }).click()
  await expect(panel.getByText(/paid request/)).toHaveCount(0)
})
