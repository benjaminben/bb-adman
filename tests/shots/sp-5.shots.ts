// SP-5: subject photos (spec/subject-photos.md). The brief form with a loaded brief's photos,
// its notes, the problem line of a typed brief, a project subject's attached pictures, the
// master with the photo placed, the pre-ticked references and the chooser's second list.
// Every picture is a made-up drawing from the fixtures; every run uses no provider.
import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import * as w from '../e2e/workflow-5-1-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const TWO_SUBJECTS = path.resolve('tests/fixtures/briefs/s2-13-brief.yaml')
const CITRUS = path.resolve('tests/fixtures/briefs/photos/citrus-can.png')
const BERRY = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')
const GLASS = path.resolve('tests/shots/fixtures/photos/glass-bottle.png')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const briefForm = (page: Page): Locator => page.getByRole('region', { name: 'Brief' })

async function loadBrief(page: Page, file: string): Promise<Locator> {
  await screens.answerOpenDialog(session!.app, [file])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const brief = briefForm(page)
  await expect(brief.getByRole('list', { name: 'Subjects' })).toBeVisible()
  return brief
}

test('A loaded brief with its photos, then the notes on photos it could not use', async () => {
  session = await openApp()
  const { box, page } = session
  await screens.createProject(page, 'Lakeside Drinks')
  const brief = await loadBrief(page, TWO_SUBJECTS)
  await screens.expectPhoto(brief, 1, CITRUS)
  await screens.expectPhoto(brief, 2, BERRY)
  await expect(brief.getByText(/^This brief added 2 photo\(s\)\./)).toBeVisible()
  await shot(page, '140-brief-photos')
  await brief.getByRole('button', { name: 'Cancel' }).click()

  // A brief in a folder of its own naming a path outside it, a missing file and a text file.
  const folder = path.join(box.root, 'brief-with-notes')
  fs.mkdirSync(folder)
  fs.copyFileSync(CITRUS, path.join(box.root, 'outside.png'))
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'Not a picture.')
  const named =
    '    pictures:\n      - ../outside.png\n      - photos/missing.png\n      - notes.txt\n'
  const text = fs.readFileSync(screens.E2E_BRIEF, 'utf8')
  const file = path.join(folder, 'brief.yaml')
  fs.writeFileSync(file, text.replace('    pictures: photos/citrus-can.png\n', named))
  const noted = await loadBrief(page, file)
  const notes = noted.getByRole('list', { name: 'Notes on the photos of subject 1' })
  await expect(notes.getByRole('listitem')).toHaveCount(2)
  await shot(page, '141-photo-notes')
})

async function typeBrief(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Paste a brief' }).click()
  await page.getByRole('button', { name: 'Start from an empty form' }).click()
  const brief = briefForm(page)
  await brief.getByLabel('Campaign name').fill('Back to Class')
  await brief.getByLabel('Region').fill('Canada')
  await brief.getByLabel('Region').blur()
  await brief.getByLabel('Audience').fill('Students heading back to college in September')
  await brief.getByLabel('Message').fill('Fresh fizz for every lecture.')
  return brief
}

test('A typed brief with no photo, then a project subject with its attached picture', async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Lakeside Drinks')
  const typed = await typeBrief(page)
  const row = typed.getByRole('group', { name: 'Subject 1' })
  await row.getByLabel('Name').fill('Apple can')
  await expect(typed.getByText('Subject 1: add at least one photo.')).toBeVisible()
  await shot(page, '142-typed-brief-no-photo')
  await typed.getByRole('button', { name: 'Cancel' }).click()

  // A first campaign attaches the brief's photos to its subjects.
  const loaded = await loadBrief(page, TWO_SUBJECTS)
  await loaded.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('button', { name: 'Back to project' }).click()

  const brief = await typeBrief(page)
  const first = brief.getByRole('group', { name: 'Subject 1' })
  await first.getByLabel('Name').fill('Citrus can')
  await first.getByLabel('Use a subject this project has').check()
  await first.getByLabel('Project subject').selectOption('citrus-can')
  await screens.expectPhoto(brief, 1, CITRUS)
  await expect(first.getByText('Already attached')).toBeVisible()
  await screens.addPhoto(app, brief, 1, GLASS)
  await expect(brief.getByRole('button', { name: 'Create campaign' })).toBeEnabled()
  await shot(page, '143-existing-subject-photos')
})

test('The master with the subject photo placed', async () => {
  session = await openApp()
  const { page } = session
  await screens.createProject(page, 'Summer Launch')
  const brief = await loadBrief(page, screens.E2E_BRIEF)
  await screens.expectPhoto(brief, 1, CITRUS)
  await brief.getByRole('checkbox', { name: 'Start the ad with a subject photo placed' }).check()
  await brief.getByRole('button', { name: 'Create campaign' }).click()
  await w.openMaster(page)
  const place = await w.placeOf(page, screens.E2E_CAMPAIGN)
  const layers = await w.layersOf(page, place)
  expect(layers.some((l) => l.slot === 'subject-image' && l.source !== null)).toBe(true)
  await page.waitForTimeout(500)
  await shot(page, '144-place-box-ticked')
})

test("The subject's photo pre-ticked, then in the picture chooser's second list", async () => {
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Summer Launch')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const references = screens.picturePanel(page).getByRole('region', { name: 'Reference pictures' })
  const tick = references.getByRole('checkbox', { name: path.basename(CITRUS), exact: true })
  await expect(tick).toBeChecked()
  await references.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, '145-references-pre-ticked')

  // "Add pictures" here imports into the reference library, attached to the subject.
  await screens.answerOpenDialog(app, [BERRY])
  await references.getByRole('button', { name: 'Add pictures' }).click()
  await expect(references.getByRole('checkbox', { name: path.basename(BERRY) })).toBeVisible()
  await w.openMaster(page)
  const place = await w.placeOf(page, screens.E2E_CAMPAIGN)
  const background = (await w.layersOf(page, place)).find((l) => l.type === 'background')!
  await w.selectLayer(page, background.name)
  const fields = page.getByRole('region', { name: 'Properties' }).getByRole('group', {
    name: 'Picture',
  })
  await fields.getByRole('button', { name: 'Choose picture…' }).click()
  const chooser = page.getByRole('dialog', { name: /^Choose a picture for / })
  const second = chooser.getByRole('list', { name: 'Subject photos in the reference library' })
  await expect(second.getByRole('listitem')).toHaveCount(1)
  await page.waitForTimeout(300)
  await shot(page, '146-chooser-subject-references')
})
