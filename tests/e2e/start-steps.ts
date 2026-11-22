// The start screen's steps, shared through screens.ts. The start screen has no top bar
// (START-2): over a project the switcher's "Start screen" leads there; on the start screen
// itself nothing needs pressing. "New project" opens the row of the name field, the folder
// button and Create. Not a test file itself.
import { expect, type Page } from '@playwright/test'

const switcher = (page: Page) => page.locator('header button[aria-haspopup="menu"]')
const newProject = (page: Page) => page.getByRole('button', { name: 'New project' })
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Project name' })

// The start screen, through the project switcher when a project shows (spec/editor.md, "The
// shell").
export async function showStart(page: Page): Promise<void> {
  const shown = newProject(page).or(nameField(page))
  await expect(switcher(page).or(shown).first()).toBeVisible()
  if (await shown.first().isVisible()) return
  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Start screen' }).click()
}

// Opens the New project row, unless it is open already.
export async function openNewProject(page: Page): Promise<void> {
  if (await nameField(page).isVisible()) return
  await newProject(page).click()
  await expect(nameField(page)).toBeFocused()
}

export async function createProject(page: Page, name: string): Promise<void> {
  await showStart(page)
  await openNewProject(page)
  await nameField(page).fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}
