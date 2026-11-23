// CW-8: the screen steps of a custom ComfyUI workflow's run, shared by the offline spec and
// cw-8.shots.ts. The person adds a fixture workflow in Settings through the system picker,
// then makes pictures with it from the run dialog. Nothing here contacts a real server. Not a
// test file itself.
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { Sandbox } from './launch'
import * as screens from './screens'

export const FIXTURES = path.resolve('tests/fixtures/comfy-custom')

export const workflowsSection = (page: Page): Locator =>
  page.getByRole('region', { name: 'ComfyUI workflows' })

// Writes the graph as the person's own file `{name}.json` and adds it through the picker.
export async function addInSettings(
  app: ElectronApplication,
  page: Page,
  box: Sandbox,
  name: string,
  graph: unknown,
): Promise<void> {
  const picked = path.join(box.root, `${name}.json`)
  fs.writeFileSync(picked, JSON.stringify(graph))
  await screens.openSettingsPage(page, 'AI services')
  const section = workflowsSection(page)
  await screens.answerOpenDialog(app, [picked])
  await section.getByRole('button', { name: 'Add workflow…' }).click()
  await expect(section.getByText(`Added ${name}.`)).toBeVisible()
}

export const pictureGraph = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'picture.json'), 'utf8')) as Record<
    string,
    unknown
  >

// A project from the test brief, the master's background chosen, its photos let go, and the
// run dialog open on ComfyUI for one picture with the named workflow picked.
export async function runDialogWith(
  app: ElectronApplication,
  page: Page,
  projectName: string,
  prompt: string,
  workflow: string,
): Promise<Locator> {
  await screens.createProject(page, projectName)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseSlot(page)
  await screens.untickReferences(page)
  await screens.setPrompt(page, prompt)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.setCount(page, 1)
  const dialog = await screens.openRunDialog(page)
  const picker = dialog.getByRole('combobox', { name: 'Workflow' })
  await picker.selectOption({ label: workflow })
  await expect(dialog.getByText(new RegExp(`with the workflow ${workflow}\\.`))).toBeVisible()
  return dialog
}
