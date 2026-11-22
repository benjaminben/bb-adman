// P6-17, Phase 6 exit criterion 2: workflow 5.2 end to end in the built app with
// ADMAN_FAKE_PROVIDERS=1. A master fanned out to two more sizes and to de and ja; the grid's
// "Translation not approved" marks; one German text typed over; "Approve all" per language; the
// translation sheet saved and read back; a prohibited "!" warned on the right post, fixed, and
// the checks run again with no warning; every translation approved at the end.
// Ruling for this slice: no forced failure. The fake can be made to fail only from inside the
// main process, and no test hook is added, so a failed translation and its Retry are proved by
// the integration tests (tests/integration/translation/retry.test.ts) and p6-13's shots.
// No paid call and no request leaves the computer. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { appWindow } from './publish-steps'
import * as l from './localize-steps'
import * as v from './variants-steps'

const SHEET = 'lantern-bay-translations.csv'
const HEADER = '"variant_id","title","size","language","layer","source_text","text","status"'
const LOUD = 'Kühl bleiben, Schluck für Schluck!'
const CALM = 'Kühl bleiben, Schluck für Schluck'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await appWindow(app)
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// "{language} · 0 of {n} approved": gives n.
async function rowCount(language: string): Promise<number> {
  const heading = await l.group(page, language).getByRole('heading').first().textContent()
  const n = Number(/ of (\d+) approved$/.exec(heading ?? '')?.[1])
  expect(n).toBeGreaterThan(0)
  return n
}

test('Workflow 5.2: fan-out to sizes and languages, translations approved, sheet, checks', async () => {
  test.setTimeout(240_000)
  await l.localise(app, page, 'Lantern Bay')

  // Every new translation is proposed by the fake ("[{to}] {text}"); none is approved yet.
  const german = await rowCount('German')
  const japanese = await rowCount('Japanese')
  await expect(l.rows(page, 'German')).toHaveCount(german)
  await expect(l.rows(page, 'Japanese')).toHaveCount(japanese)
  await expect(l.rows(page, 'Japanese').first().getByText('from AI')).toBeVisible()
  await expect(l.rows(page, 'Japanese').first().getByRole('textbox')).toHaveValue(/^\[ja\] /)
  await expect(l.translations(page).getByText(/^The translation did not finish: /)).toHaveCount(0)

  // One German text typed over, then "Approve all" for each language.
  await l.typeFirst(page, 'German', LOUD)
  await l.approveAll(page, 'German', german)
  await l.approveAll(page, 'Japanese', japanese)
  await expect(v.grid(page, l.DIRECTION).getByText('Translation not approved')).toHaveCount(0)

  // The sheet, saved where the dialog said, read back.
  const file = path.join(box.root, SHEET)
  await l.answerSaveDialog(app, file)
  await l.exportSheet(page, SHEET)
  await expect(l.translations(page).getByText(box.root)).toHaveCount(0)
  const sheet = fs.readFileSync(file, 'utf8')
  expect(sheet.startsWith('﻿')).toBe(true)
  const lines = sheet
    .slice(1)
    .split('\r\n')
    .filter((line) => line !== '')
  expect(sheet.slice(1).replaceAll('\r\n', '')).not.toContain('\n')
  expect(lines[0]).toBe(HEADER)
  expect(lines).toHaveLength(1 + german + japanese)
  expect(lines.filter((line) => line.endsWith(',"approved"'))).toHaveLength(german + japanese)
  expect(lines.filter((line) => line.includes(`"${LOUD}"`))).toHaveLength(1)

  // The brief's required words are cleared, so only what follows warns. "!" is prohibited in
  // German: the one post with the typed text warns.
  await l.setWords(page, 'Required words', 'en', '')
  await l.setWords(page, 'Prohibited words', 'de', '!')
  await l.runChecks(page, 1)
  const warned = l.warnedBlocks(page, 'Prohibited words')
  await expect(warned).toHaveCount(1)
  await expect(warned.getByRole('heading')).toHaveText(/ · de$/)
  await expect(warned.getByText(/contains “!”\.$/)).toBeVisible()

  // The "!" taken out; the edit sets it back to proposed, so it is approved again.
  await l.typeFirst(page, 'German', CALM)
  await expect(l.group(page, 'German').getByRole('heading').first()).toHaveText(
    `German · ${german - 1} of ${german} approved`,
  )
  await l.approveAll(page, 'German', german)
  await l.runChecks(page, 0)
  await expect(l.warnedBlocks(page, 'Prohibited words')).toHaveCount(0)
  await expect(l.warnedBlocks(page, 'Translations approved')).toHaveCount(0)

  // Every translation approved at the end.
  for (const [language, n] of [
    ['German', german],
    ['Japanese', japanese],
  ] as const) {
    await expect(l.rows(page, language).getByText('Approved', { exact: true })).toHaveCount(n)
  }
  await expect(v.grid(page, l.DIRECTION).getByText('Translation not approved')).toHaveCount(0)
})
