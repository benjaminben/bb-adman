// R2P-12 (spec/phases/round-2-platform.md, D5 to D9; security class short): the agent path in
// the built app. The user turns on agent access in Settings and works in their own project; an
// MCP client in this test process creates a project, imports two pictures by full path (the
// test answers the dialog as the user would), is refused a third import, and makes a campaign
// from a Markdown brief twice: once naming an imported asset by ID (no dialog), once naming a
// full path (dialog, "Allow"). The window stays on the user's project throughout. Every reply
// is kept and checked for paths, file names and the brief's text. No provider call; nothing
// leaves the computer; the token is never printed. Made-up names and drawn pictures only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { writePng } from './drop-files'
import * as screens from './screens'
import { connectThroughSettings } from './mcp-workflow-steps'
import { replyJson, type ToolReply, type ToolSession } from '../integration/mcp/tool-client'

const MINE = 'Harbour Lights'
const AGENTS = 'Fern Studio Spring'
const NAMES = ['fern-leaf-tile.png', 'moss-circle.png', 'refused-swatch.png', 'lemon-tile.png']

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// A made-up brief in the D2 Markdown form; one subject whose one picture is `picture`.
const brief = (campaign: string, subject: string, picture: string) =>
  [
    `# ${campaign}`,
    '',
    'Region: Canada',
    'Audience: Adults 25 to 40 who keep house plants',
    '',
    '## Message',
    'Green corners that grow with you.',
    '',
    '## Subjects',
    '',
    `### ${subject}`,
    'Pictures:',
    `- ${picture}`,
  ].join('\n')

// The PNG files on disk under the default projects folder: what has been imported so far.
function importedPngs(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.toLowerCase().endsWith('.png')) found.push(full)
    }
  }
  if (fs.existsSync(box.projects)) walk(box.projects)
  return found
}

// The window still shows the user's own project, with the agent's listed beside it [D9].
async function stillOnMine(p: Page) {
  await expect(p.getByRole('heading', { name: MINE, level: 1 })).toBeVisible()
  await expect(p.getByRole('button', { name: `${MINE} 2 projects open` })).toBeVisible()
}

type Answer = { title: string; allow: string; files: string[]; had: number; yes: boolean }

// The user reads the full paths in the dialog, sees nothing imported yet, and answers.
async function answerDialog(p: Page, a: Answer) {
  const dialog = p.getByRole('dialog', { name: a.title })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  const items = dialog.getByRole('list', { name: 'Files' }).getByRole('listitem')
  await expect(items).toHaveText(a.files)
  await expect(dialog.getByRole('button', { name: a.allow })).not.toHaveAttribute('aria-disabled')
  expect(importedPngs()).toHaveLength(a.had)
  await dialog.getByRole('button', { name: a.yes ? a.allow : 'Refuse' }).click()
  await expect(dialog).toBeHidden()
}

test('R2P-12: an agent makes a project, imports by path and makes campaigns from briefs', async () => {
  test.setTimeout(240_000)
  const tool = await connectThroughSettings(page)
  await screens.createProject(page, MINE)

  // The sandbox's real path: a path through a link (/var to /private/var) is refused [D5].
  const dir = path.join(fs.realpathSync(box.root), 'Agent pictures')
  fs.mkdirSync(dir)
  const files = NAMES.map((n) => path.join(dir, n))
  files.forEach((f, i) => writePng(f, [40 + i * 50, 140, 90 - i * 20]))

  const replies: string[] = []
  const call = async (s: ToolSession, name: string, args: unknown): Promise<ToolReply> => {
    const reply = await s.call(name, args)
    replies.push(JSON.stringify(reply))
    return reply
  }

  // 1. create_project gives exactly the project ID and the name, and no path.
  const created = await call(tool, 'create_project', { name: AGENTS })
  expect(created.isError).toBeFalsy()
  const project = replyJson<Record<string, unknown>>(created)
  expect(Object.keys(project).sort()).toEqual(['name', 'projectId'])
  expect(project.name).toBe(AGENTS)
  const projectId = String(project.projectId)
  await stillOnMine(page)

  // 2. import_assets: both full paths on screen; nothing imported before "Import"; IDs only.
  const imports = call(tool, 'import_assets', { project_id: projectId, paths: files.slice(0, 2) })
  const asked = { title: 'An agent asks to import files', allow: 'Import' }
  await answerDialog(page, { ...asked, files: files.slice(0, 2), had: 0, yes: true })
  const imported = await imports
  expect(imported.isError).toBeFalsy()
  const { assetIds } = replyJson<{ assetIds: string[] }>(imported)
  expect(Object.keys(replyJson<object>(imported))).toEqual(['assetIds'])
  expect(assetIds).toHaveLength(2)
  expect(importedPngs()).toHaveLength(2)

  // 3. A second import answered "Refuse" imports nothing and tells the agent so.
  const third = call(tool, 'import_assets', { project_id: projectId, paths: [files[2]] })
  await answerDialog(page, { ...asked, files: [files[2]!], had: 2, yes: false })
  const refused = await third
  expect(refused.isError).toBe(true)
  expect(replyJson(refused)).toMatchObject({ code: 'AGENT_REFUSED' })
  expect(importedPngs()).toHaveLength(2)

  // 4. A brief naming an imported picture by its asset ID makes the campaign with no dialog.
  const idBrief = brief('Fern corner', 'Fern pot', assetIds[0]!)
  const byId = await call(tool, 'create_campaign_from_brief', {
    project_id: projectId,
    text: idBrief,
  })
  expect(byId.isError).toBeFalsy()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const first = replyJson<{ campaignId: string; subjectIds: string[] }>(byId)
  expect(first.campaignId).toBeTruthy()
  expect(first.subjectIds).toHaveLength(1)

  // 5. A brief naming a full path asks first ("Allow"); then the campaign, subject and photo.
  const pathBrief = brief('Lemon window', 'Lemon planter', files[3]!)
  const byPath = call(tool, 'create_campaign_from_brief', {
    project_id: projectId,
    text: pathBrief,
  })
  const campaignAsk = { title: 'An agent asks to make a campaign with files', allow: 'Allow' }
  await answerDialog(page, { ...campaignAsk, files: [files[3]!], had: 2, yes: true })
  const second = await byPath
  expect(second.isError).toBeFalsy()
  const made = replyJson<{ campaignId: string; subjectIds: string[]; assetIds: string[] }>(second)
  expect(made.assetIds).toHaveLength(1)
  expect(importedPngs()).toHaveLength(3)

  const read = replyJson<{ campaigns: Array<{ id: string }> }>(
    await call(tool, 'get_project', { project_id: projectId }),
  )
  expect(read.campaigns.map((c) => c.id).sort()).toEqual([first.campaignId, made.campaignId].sort())
  const subjects = replyJson<Array<{ id: string; assetIds: string[] }>>(
    await call(tool, 'list_subjects', { project_id: projectId }),
  )
  const photoOf = (id: string) => subjects.find((s) => s.id === id)?.assetIds
  expect(photoOf(first.subjectIds[0]!)).toEqual([assetIds[0]])
  expect(photoOf(made.subjectIds[0]!)).toEqual(made.assetIds)

  // 6. The window stayed on the user's project; the switcher lists the agent's project.
  await stillOnMine(page)
  await page.getByRole('button', { name: `${MINE} 2 projects open` }).click()
  await expect(page.getByRole('menuitem', { name: AGENTS, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // 7. No reply held a sandbox path, an imported file's name or a brief's text.
  const banned = [box.root, fs.realpathSync(box.root), ...NAMES, idBrief, pathBrief]
  for (const reply of replies) for (const word of banned) expect(reply).not.toContain(word)
})
