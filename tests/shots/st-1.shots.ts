// ST-1: the new token values on two screens that use many of them. The start screen shows the
// warm page ground and the spot colour; the editor shows the canvas backdrop, panel lines and
// a selected layer.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('The tokens on the start screen and in the editor', async () => {
  session = await openApp()
  const { app, page } = session
  await expect(page.getByRole('button', { name: 'Adman' })).toBeVisible()
  await shot(page, '180-tokens-start')

  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  const variants = page.getByRole('list', { name: 'Variants' })
  await expect(variants.getByRole('listitem')).toHaveCount(1)
  await variants.getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: /^Headline/ }).click()
  await page.waitForTimeout(500)
  await shot(page, '181-tokens-editor')
})
