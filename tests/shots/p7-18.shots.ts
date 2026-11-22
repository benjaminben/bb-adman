// P7-18: the timeline of a video variant. 222: at 0. 223: playing. 224: scrubbed to the middle.
// The video variant is made in the closed project file (tests/e2e/timeline-seed.ts), as no
// screen changes the format yet.
import { test, expect } from '@playwright/test'
import { dragRuler, openVideoEditor, rulerTime, timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('the timeline at 0, playing, and scrubbed to the middle', async () => {
  session = await openApp()
  const { app, page } = session
  await openVideoEditor(app, page, 'Lemon Fizz')
  await shot(page, '222-timeline-start')

  await timeline(page).getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => rulerTime(page)).toBeGreaterThan(1500)
  await shot(page, '223-timeline-playing')
  await timeline(page).getByRole('button', { name: 'Pause' }).click()

  await dragRuler(page, 0.2, 0.5)
  await shot(page, '224-timeline-scrubbed')
})
