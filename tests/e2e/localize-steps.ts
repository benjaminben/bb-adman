// P6-17: the steps workflow 5.2 (localise a master into more sizes and languages) and the p6-17
// shots share. Every step uses the screens as the user does: Settings for the fake text
// provider, the brief form, "Fan out…", the translation panel, the rule set panel and the check
// panel. The native save dialog cannot be clicked, so it is answered in the main process as
// save-picker.spec.ts and p6-13.shots.ts do; no app code changes. Not a test file itself.
// Made-up names only; only the fake provider runs, nothing is paid and nothing leaves the
// computer.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { showCampaignView } from './campaign-view-steps'
import * as screens from './screens'
import * as v from './variants-steps'

export const DIRECTION = 'Direction 1'
export const TALL = '9x16 (1080×1920)'
export const WIDE = '16x9 (1920×1080)'
// The master at 1x1 in en, fanned out to two more sizes and to de and ja: 3 sizes x 3 languages.
export const POSTS = 9
export const TRANSLATED_POSTS = 6

// Settings · Default AI providers: the fake provider for text, before any project is open.
export async function chooseFakeText(page: Page): Promise<void> {
  await screens.openSettings(page)
  const fake = page
    .getByRole('group', { name: 'Text: briefs, copy and translation' })
    .getByRole('button', { name: 'Fake provider' })
  await fake.click()
  await expect(fake).toHaveAttribute('aria-pressed', 'true')
}

// The project, the brief form in en, de and ja with one more size, and the fan-out to the two
// other sizes and both languages. Waits until the fake's translations are on the grid.
export async function localise(app: ElectronApplication, page: Page, project: string) {
  await chooseFakeText(page)
  await screens.createProject(page, project)
  await v.createFromForm(app, page, { languages: 'en, de, ja', sizes: [WIDE] })
  await v.fanOut(page, DIRECTION, { sizes: [TALL, WIDE], languages: ['de', 'ja'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(POSTS)
  await expect(v.grid(page, DIRECTION).getByTitle('Translation not approved')).toHaveCount(
    TRANSLATED_POSTS,
    { timeout: 60_000 },
  )
}

export const translations = (page: Page): Locator =>
  page.getByRole('region', { name: 'Translations' })

// The language's Section, its heading the language's name (CAMP-5).
export const group = (page: Page, language: string): Locator =>
  translations(page).getByRole('region', { name: language, exact: true })

// The language's approved bar, its title "{a} of {n} approved" (CAMP-5).
export const approvedBar = (page: Page, language: string): Locator =>
  group(page, language).getByTitle(/^\d+ of \d+ approved$/)

// "{a} of {n} approved" read from the bar: gives [a, n].
export async function approvedCount(page: Page, language: string): Promise<[number, number]> {
  const tip = (await approvedBar(page, language).getAttribute('title')) ?? ''
  const found = /^(\d+) of (\d+) approved$/.exec(tip)
  return [Number(found?.[1]), Number(found?.[2])]
}

export const rows = (page: Page, language: string): Locator =>
  group(page, language)
    .getByRole('list', { name: `${language} translations` })
    .getByRole('listitem')

// Types over the first row's text and leaves the field, as the user does.
export async function typeFirst(page: Page, language: string, text: string): Promise<void> {
  await showCampaignView(page, 'Translations')
  const field = rows(page, language).first().getByRole('textbox')
  await field.fill(text)
  await field.blur()
  await expect(rows(page, language).first().getByText('from you')).toBeVisible()
  await expect(rows(page, language).first().getByRole('textbox')).toHaveValue(text)
}

export async function approveAll(page: Page, language: string, count: number): Promise<void> {
  await showCampaignView(page, 'Translations')
  await group(page, language)
    .getByRole('button', { name: `Approve all ${language}` })
    .click()
  await expect(approvedBar(page, language)).toHaveAttribute(
    'title',
    `${count} of ${count} approved`,
  )
}

// The next save dialog answers with this path, as if the user had chosen it.
export async function answerSaveDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, given) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: given,
    })) as unknown as typeof dialog.showSaveDialog
  }, filePath)
}

export async function exportSheet(page: Page, fileName: string): Promise<void> {
  await showCampaignView(page, 'Translations')
  await translations(page).getByRole('button', { name: 'Export translation sheet…' }).click()
  // CAMP-5: a "Saved" mark with the file's base name in its title.
  await expect(translations(page).getByTitle(fileName, { exact: true })).toContainText('Saved')
}

// The Checks tab's "Rules" Section, opened when it is shut (CAMP-4: it starts shut when a rule
// is set).
export async function openRules(page: Page): Promise<Locator> {
  await showCampaignView(page, 'Checks')
  const rules = page.getByRole('region', { name: 'Rules', exact: true })
  const fold = rules.getByRole('button', { name: 'Rules', exact: true })
  if ((await fold.getAttribute('aria-expanded')) === 'false') await fold.click()
  return rules
}

// One of the rule set's word lists, "Required words" or "Prohibited words", for one language,
// saved on leaving the field. With two or more languages the language is chosen first in the
// group "Word list language".
export async function setWords(page: Page, list: string, tag: string, words: string) {
  const rules = await openRules(page)
  const languages = rules.getByRole('group', { name: 'Word list language' })
  if ((await languages.count()) > 0) {
    await languages.getByRole('button', { name: tag, exact: true }).click()
  }
  const field = rules.getByRole('textbox', { name: `${list} (${tag})`, exact: true })
  await field.fill(words)
  await field.blur()
  await expect(field).toHaveValue(words)
}

export const checks = (page: Page): Locator => page.getByRole('region', { name: 'Checks' })

// Each checked post's row group in the check table (the head row's group left out).
const postRows = (page: Page): Locator =>
  checks(page)
    .getByRole('rowgroup')
    .filter({ has: page.locator('th[scope="row"]') })

// "Run checks", then wait until every post has its row, none is out of date and the warnings
// mark shows the count ("1 warning", "2 warnings"; no mark at 0).
export async function runChecks(page: Page, warnings: number): Promise<void> {
  await showCampaignView(page, 'Checks')
  const run = checks(page).getByRole('button', { name: 'Run checks', exact: true })
  await run.click()
  await expect(run).toBeEnabled({ timeout: 30_000 })
  await expect(postRows(page)).toHaveCount(POSTS, { timeout: 30_000 })
  await expect(checks(page).getByRole('button', { name: /^\d+ not checked/ })).toHaveCount(0)
  const mark = checks(page).getByRole('button', { name: /^\d+ warnings?\b/ })
  if (warnings === 0) await expect(mark).toHaveCount(0)
  else await expect(mark).toHaveText(warnings === 1 ? '1 warning' : `${warnings} warnings`)
}

// The posts with a warning on the named check, such as "Prohibited words": a cell's mark is
// named "{check}: warning".
export const warnedBlocks = (page: Page, check: string): Locator =>
  postRows(page).filter({
    has: page.getByRole('cell', { name: `${check}: warning`, exact: true }),
  })

// Opens a post's findings under its row (its button holds "{size} · {language}").
export async function openFindings(block: Locator): Promise<void> {
  const button = block.getByRole('button').first()
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
}
