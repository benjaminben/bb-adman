// P5-19: 170, the campaign overview with two directions, through the screen tour's stop
// (screen-tour.ts, directionsTour). 171 (a failed fill with Retry) is not made: the fake
// provider fails only through setFakeBehaviour in the main process, which the built app does
// not reach, and no test hook is added for it. The fake provider only. Made-up names only.
import { test } from '@playwright/test'
import { directionsTour } from '../e2e/screen-tour'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The overview with two directions', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  await directionsTour(session.app, session.page)
  await shot(session.page, '170-tour-two-directions')
})
