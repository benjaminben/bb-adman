// R2P-8 (spec/phases/round-2-platform.md, D8; security class full): create_project makes an
// empty project in the user's default projects folder and opens it. The agent gives a name only
// and reads back the ID and that name; it never gives or learns a folder or a path. Nothing
// already at the name is replaced or followed.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, riskyKeys, type AskSetUp } from './ask-fixture'
import { replyJson, type ToolReply, type ToolSession } from './tool-client'
import { PROJECT_EXTENSION } from '@/shared/schemas/project'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

type Made = { projectId: string; name: string }

const DESCRIPTION =
  "Create a new, empty project in the user's default projects folder and open it in the app. " +
  "name is the project's name and its file name: no folder, at most 100 characters. An existing " +
  "file is never replaced. Gives the project's ID to use as project_id."

const FILE_EXISTS = {
  code: 'RULE_VIOLATION',
  message: 'A file with this name already exists in that folder.',
  details: { reason: 'file_exists' },
}

const folderOf = (s: AskSetUp) => s.core.settings.get().defaultProjectDir
// The entries in the default folder, without SQLite's journal files.
const entries = (s: AskSetUp) =>
  fs.existsSync(folderOf(s))
    ? fs.readdirSync(folderOf(s)).filter((n) => !n.endsWith('-journal'))
    : []
const fileAt = (s: AskSetUp, name: string) => path.join(folderOf(s), `${name}${PROJECT_EXTENSION}`)
const create = (t: ToolSession, args: unknown) => t.call('create_project', args)
const errorOf = (r: ToolReply) => r.content?.[0]?.text ?? ''

describe('create_project [R2P-8, D8]', () => {
  it('is listed with its description and takes only a name', async () => {
    x = await askSetUp()
    const tool = (await (await x.session()).list()).find((t) => t.name === 'create_project')
    expect(tool?.description).toBe(DESCRIPTION)
    const schema = tool?.inputSchema as { properties: object; required: string[] }
    expect(Object.keys(schema.properties)).toEqual(['name'])
    expect(schema.required).toEqual(['name'])
  })

  it('makes the file in the default folder, opens it, and replies the ID and the name only', async () => {
    x = await askSetUp()
    const t = await x.session()
    const reply = await create(t, { name: 'Autumn Work' })
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    expect(Object.keys(made)).toEqual(['projectId', 'name'])
    expect(made.name).toBe('Autumn Work')
    expect(fs.lstatSync(fileAt(x, 'Autumn Work')).isFile()).toBe(true)
    expect(x.core.projects.get(made.projectId)?.filePath).toBe(fileAt(x, 'Autumn Work'))
    expect(x.core.settings.get().recentProjects[0]?.name).toBe('Autumn Work')
    expect(x.events.map((e) => e.name)).toContain('app.stateChanged')
    const listed = replyJson<Made[]>(await t.call('list_projects', {}))
    expect(listed.map((p) => p.name)).toEqual(['Spring Work', 'Autumn Work'])
    expect((await t.call('get_project', { project_id: made.projectId })).isError).toBeFalsy()
  })

  it('drops a location, a folder or a path the agent adds, and makes the file in the default folder', async () => {
    x = await askSetUp()
    const t = await x.session()
    const elsewhere = path.join(path.dirname(folderOf(x)), 'elsewhere')
    const args = { name: 'Winter Work', location: elsewhere, folder: elsewhere, path: elsewhere }
    const made = replyJson<Made>(await create(t, args))
    expect(made.name).toBe('Winter Work')
    expect(fs.existsSync(elsewhere)).toBe(false)
    expect(x.core.projects.get(made.projectId)?.filePath).toBe(fileAt(x, 'Winter Work'))
  })

  it('is denied project.create, project.open and project.close as before', async () => {
    x = await askSetUp()
    const s = x
    for (const [name, input] of [
      ['project.create', { name: 'Sneaky', location: folderOf(s) }],
      ['project.open', { filePath: fileAt(s, 'Spring Work') }],
      ['project.close', { projectId: s.projectId }],
    ] as const) {
      expect(await s.agent(name, input), name).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED' },
      })
    }
  })

  it('works with no project open: list_projects is empty, then holds only the new one', async () => {
    x = await askSetUp()
    data(await x.user('project.close', { projectId: x.projectId }))
    const t = await x.session()
    expect(replyJson(await t.call('list_projects', {}))).toEqual([])
    const made = replyJson<Made>(await create(t, { name: 'Fresh Start' }))
    const listed = replyJson<Array<{ id: string }>>(await t.call('list_projects', {}))
    expect(listed.map((p) => p.id)).toEqual([made.projectId])
  })
})

describe('create_project refuses a name that is not one safe file name [R2P-8, D8]', () => {
  it.each([
    ['a slash', 'Plans/Autumn'],
    ['two dots', '..'],
    ['a backslash', 'Plans\\Autumn'],
    ['two leading separators', '//server/share'],
    ['two leading backslashes', '\\\\server\\share'],
    ['a colon', 'Plans: Autumn'],
    ['a star', 'Autumn*'],
    ['a question mark', 'Autumn?'],
    ['a quote', 'Autumn "Work"'],
    ['angle brackets', '<Autumn>'],
    ['a bar', 'Autumn|Work'],
    ['a control character', 'Autumn\u0007Work'],
    ['a nul character', 'Autumn\u0000Work'],
    ['a line break', 'Autumn\nWork'],
    ['a leading dot', '.Autumn'],
    ['a trailing dot', 'Autumn.'],
    ['a trailing dot then a space', 'Autumn. '],
    ['CON', 'CON'],
    ['con with an extension', 'con.txt'],
    ['NUL', 'nul'],
    ['COM1', 'Com1'],
    ['LPT1 with an extension', 'LPT1.adman'],
    ['an empty name', ''],
    ['spaces only', '   '],
    ['101 characters', 'a'.repeat(101)],
    ['a number', 7],
  ])('%s, and makes no file', async (_label, name) => {
    x = await askSetUp()
    const t = await x.session()
    fs.mkdirSync(folderOf(x), { recursive: true })
    const before = entries(x)
    const reply = await create(t, { name })
    expect(reply.isError).toBe(true)
    expect(errorOf(reply)).not.toContain(folderOf(x))
    expect(entries(x)).toEqual(before)
    expect(x.core.projects.all()).toHaveLength(1)
  })

  it('takes 100 characters, and trims spaces so no file name ends with one', async () => {
    x = await askSetUp()
    const t = await x.session()
    expect(replyJson<Made>(await create(t, { name: 'a'.repeat(100) })).name).toHaveLength(100)
    expect(replyJson<Made>(await create(t, { name: '  Autumn Work  ' })).name).toBe('Autumn Work')
    expect(entries(x).sort()).toEqual([`${'a'.repeat(100)}.adman`, 'Autumn Work.adman'].sort())
  })

  it('tells the agent which rule failed', async () => {
    x = await askSetUp()
    const t = await x.session()
    expect(errorOf(await create(t, { name: 'CON' }))).toContain('Windows reserves that name.')
    expect(errorOf(await create(t, { name: 'a/b' }))).toContain('Names cannot contain')
  })
})

describe('create_project never replaces or follows what is at the name [R2P-8, D8]', () => {
  it('refuses a file at the name and leaves it as it was', async () => {
    x = await askSetUp()
    fs.mkdirSync(folderOf(x), { recursive: true })
    fs.writeFileSync(fileAt(x, 'Autumn Work'), 'made-up older file')
    const reply = await create(await x.session(), { name: 'Autumn Work' })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(FILE_EXISTS)
    expect(fs.readFileSync(fileAt(x, 'Autumn Work'), 'utf8')).toBe('made-up older file')
  })

  it('refuses a folder, a link to a file and a link that leads nowhere; no target is made', async () => {
    x = await askSetUp()
    const s = x
    const t = await s.session()
    fs.mkdirSync(folderOf(s), { recursive: true })
    const outside = path.join(path.dirname(folderOf(s)), 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'kept.txt'), 'made-up notes')
    fs.mkdirSync(fileAt(s, 'A Folder'))
    fs.symlinkSync(path.join(outside, 'kept.txt'), fileAt(s, 'A Link'))
    fs.symlinkSync(path.join(outside, 'never.adman'), fileAt(s, 'A Dangling Link'))
    for (const name of ['A Folder', 'A Link', 'A Dangling Link']) {
      expect(replyJson(await create(t, { name })), name).toEqual(FILE_EXISTS)
    }
    expect(fs.readdirSync(outside)).toEqual(['kept.txt'])
    expect(fs.readFileSync(path.join(outside, 'kept.txt'), 'utf8')).toBe('made-up notes')
    expect(fs.readdirSync(fileAt(s, 'A Folder'))).toEqual([])
    expect(s.core.projects.all()).toHaveLength(1)
  })
})

describe('nothing about the folder leaves [R2P-8, D8]', () => {
  it('holds for every reply, refusal, event and log line, with riskyKeys and the word test', async () => {
    x = await askSetUp()
    const s = x
    const t = await s.session()
    fs.mkdirSync(folderOf(s), { recursive: true })
    fs.symlinkSync(path.join(folderOf(s), 'gone'), fileAt(s, 'Taken'))
    const replies: unknown[] = []
    for (const args of [
      { name: 'Autumn Work' },
      { name: 'Taken' },
      { name: 'Plans/Autumn' },
      { name: 'CON' },
      { name: 'Winter Work', location: '/made-up-agent-folder' },
    ]) {
      const reply = await create(t, args)
      replies.push(reply.content?.[0]?.text?.startsWith('{') ? replyJson(reply) : errorOf(reply))
    }
    expect(riskyKeys(replies)).toEqual([])
    const folder = folderOf(s)
    const places: Array<[string, string]> = [
      ['reply', JSON.stringify(replies)],
      ['event', JSON.stringify(s.events)],
      ['log', s.readLogs()],
    ]
    for (const [where, text] of places) {
      for (const word of [folder, path.basename(folder), '.adman', 'made-up-agent-folder']) {
        expect(text.includes(word), `${word} in ${where}`).toBe(false)
      }
      for (const word of ['comfyui', 'baseUrl', 'agentRuns', 'autoApprove']) {
        expect(text.includes(word), `${word} in ${where}`).toBe(false)
      }
    }
  })

  it('logs no path when the default folder cannot be written', async () => {
    x = await askSetUp()
    const s = x
    fs.mkdirSync(folderOf(s), { recursive: true })
    fs.chmodSync(folderOf(s), 0o500)
    try {
      const reply = await create(await s.session(), { name: 'Autumn Work' })
      expect(reply.isError).toBe(true)
      expect(s.readLogs()).toContain('The project file could not be made (EACCES).')
      for (const text of [JSON.stringify(reply), s.readLogs()]) {
        expect(text.includes(folderOf(s))).toBe(false)
        expect(text.includes(path.basename(folderOf(s)))).toBe(false)
      }
    } finally {
      fs.chmodSync(folderOf(s), 0o700)
    }
    expect(entries(s)).toEqual([])
  })
})
