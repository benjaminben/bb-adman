// P6-17: the steps workflow 5.2 (localise a master into more sizes and languages) and the p6-17
// shots share. Every step uses the screens as the user does: Settings for the fake text
// provider, the brief form, "Fan out…", the translation panel, the rule set panel and the check
// panel. The native save dialog cannot be clicked, so it is answered in the main process as
// save-picker.spec.ts and p6-13.shots.ts do; no app code changes. Not a test file itself.
// Made-up names only; only the fake provider runs, nothing is paid and nothing leaves the
// computer.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
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
  const select = page.getByLabel('Text: briefs, copy and translation', { exact: true })
  await select.selectOption({ label: 'Fake provider' })
  await expect(select).toHaveValue('fake')
}

// The project, the brief form in en, de and ja with one more size, and the fan-out to the two
// other sizes and both languages. Waits until the fake's translations are on the grid.
export async function localise(app: ElectronApplication, page: Page, project: string) {
  await chooseFakeText(page)
  await screens.createProject(page, project)
  await v.createFromForm(app, page, { languages: 'en, de, ja', sizes: [WIDE] })
  await v.fanOut(page, DIRECTION, { sizes: [TALL, WIDE], languages: ['de', 'ja'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(POSTS)
  await expect(v.grid(page, DIRECTION).getByText('Translation not approved')).toHaveCount(
    TRANSLATED_POSTS,
    { timeout: 60_000 },
  )
}

export const translations = (page: Page): Locator =>
  page.getByRole('region', { name: 'Translations' })

// The language's group, its heading "{language} · {a} of {n} approved".
export const group = (page: Page, language: string): Locator =>
  translations(page).getByRole('region', {
    name: new RegExp(`^${language} · \\d+ of \\d+ approved$`),
  })

export const rows = (page: Page, language: string): Locator =>
  group(page, language)
    .getByRole('list', { name: `${language} translations` })
    .getByRole('listitem')

// Types over the first row's text and leaves the field, as the user does.
export async function typeFirst(page: Page, language: string, text: string): Promise<void> {
  const field = rows(page, language).first().getByRole('textbox')
  await field.fill(text)
  await field.blur()
  await expect(rows(page, language).first().getByText('from you')).toBeVisible()
  await expect(rows(page, language).first().getByRole('textbox')).toHaveValue(text)
}

export async function approveAll(page: Page, language: string, count: number): Promise<void> {
  await group(page, language)
    .getByRole('button', { name: `Approve all ${language}` })
    .click()
  const heading = `${language} · ${count} of ${count} approved`
  await expect(translations(page).getByRole('region', { name: heading })).toBeVisible()
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
  await translations(page).getByRole('button', { name: 'Export translation sheet…' }).click()
  await expect(translations(page).getByText(`Saved ${fileName}.`)).toBeVisible()
}

// One of the rule set panel's word lists, "Required words" or "Prohibited words", for one
// language, saved on leaving the field. Not exact: the label holds the field, so its words count
// in the name.
export async function setWords(page: Page, list: string, tag: string, words: string) {
  const rules = page.getByRole('region', { name: 'Brand and legal rules' })
  const field = rules.getByLabel(`${list} (${tag})`)
  await field.fill(words)
  await field.blur()
  await expect(field).toHaveValue(words)
}

export const checks = (page: Page): Locator => page.getByRole('region', { name: 'Checks' })

// "Run checks", and the summary once every post is checked and current.
export async function runChecks(page: Page, warnings: number): Promise<void> {
  await checks(page).getByRole('button', { name: 'Run checks' }).click()
  const summary = `${POSTS} posts checked · ${warnings} with brand or legal warnings · 0 not checked since a change`
  await expect(checks(page).getByText(summary, { exact: true })).toBeVisible({ timeout: 30_000 })
}

// The check blocks with a warning on the named check, such as "Prohibited words".
export const warnedBlocks = (page: Page, check: string): Locator =>
  checks(page)
    .getByRole('article')
    .filter({ has: page.getByText(`${check}: Warning`, { exact: true }) })
