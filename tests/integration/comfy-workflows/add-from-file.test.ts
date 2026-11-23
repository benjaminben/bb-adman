import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { checked } from './store-fixture'
import {
  CHOSEN_WORKFLOW_TTL_MS,
  forgetWorkflowPath,
  rememberWorkflowPath,
} from '@/main/providers/comfyui/custom/chosen-workflow-path'
import { MAX_CUSTOM_WORKFLOWS, MAX_WORKFLOW_BYTES } from '@/shared/comfy/custom-workflow'
import type { ComfyWorkflowAddFromFileReply } from '@/shared/schemas/commands/comfy-workflow'

let f: Fixture
afterEach(() => {
  vi.restoreAllMocks()
  forgetWorkflowPath()
  f.cleanup()
})

const NAME = 'Lighthouse pictures'

function fileWith(text: string, name = `${NAME}.json`): string {
  const dir = path.join(f.root, 'Downloads')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  fs.writeFileSync(file, text)
  return file
}

// Every file-system call that could name a file, so a test can tell whether a path was touched.
function watchDisk() {
  const spies = [
    vi.spyOn(fs, 'lstatSync'),
    vi.spyOn(fs, 'statSync'),
    vi.spyOn(fs, 'openSync'),
    vi.spyOn(fs, 'readFileSync'),
  ]
  return (file: string) =>
    spies.some((spy) => spy.mock.calls.some(([p]) => String(p) === file || p === file))
}

const addFrom = (filePath: string) => f.user('comfyWorkflow.addFromFile', { filePath })
const reasonOf = (result: { ok: boolean; error?: { details?: Record<string, unknown> } }) =>
  result.error?.details?.reason

describe('comfyWorkflow.addFromFile: only the picked path [D-104, security rule 9]', () => {
  it('refuses a path the picker did not give, and reads nothing', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    const touched = watchDisk()
    const result = await addFrom(file)
    expect(reasonOf(result)).toBe('workflow_not_picked')
    expect(result).toMatchObject({
      error: { code: 'RULE_VIOLATION', message: 'Choose the file again.' },
    })
    expect(touched(file)).toBe(false)
  })

  it('reads the remembered path, never the path text it was sent', async () => {
    f = makeFixture()
    const picked = fileWith(fixtureText('picture'), 'flow.json')
    // A folder elsewhere holding another workflow of the same name, and a link to a folder
    // below it, so "link/.." leads there on the disk but not in the text.
    const elsewhere = path.join(f.root, 'elsewhere')
    fs.mkdirSync(path.join(elsewhere, 'sub'), { recursive: true })
    const other = path.join(elsewhere, 'flow.json')
    fs.writeFileSync(other, fixtureText('two-refs'))
    fs.symlinkSync(path.join(elsewhere, 'sub'), path.join(path.dirname(picked), 'link'))
    const sent = `${path.dirname(picked)}/link/../flow.json`
    expect(fs.readFileSync(sent, 'utf8')).toBe(fixtureText('two-refs'))
    rememberWorkflowPath(picked)
    const touched = watchDisk()
    const reply = data<ComfyWorkflowAddFromFileReply>(await addFrom(sent))
    expect(f.core.deps.comfyWorkflows.get(reply.workflowId)?.checked.job).toBe('image')
    expect(touched(sent)).toBe(false)
    expect(touched(other)).toBe(false)
    expect(touched(picked)).toBe(true)
  })

  it('refuses a path picked more than 10 minutes ago', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    rememberWorkflowPath(file, Date.now() - CHOSEN_WORKFLOW_TTL_MS - 1)
    const touched = watchDisk()
    expect(reasonOf(await addFrom(file))).toBe('workflow_not_picked')
    expect(touched(file)).toBe(false)
  })

  it('takes a picked path once', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    rememberWorkflowPath(file)
    data(await addFrom(file))
    const touched = watchDisk()
    expect(reasonOf(await addFrom(file))).toBe('workflow_not_picked')
    expect(touched(file)).toBe(false)
  })

  it('refuses a link in place of the picked file as unreadable, and never reads its target', async () => {
    f = makeFixture()
    const target = fileWith(fixtureText('picture'), 'target.json')
    const link = path.join(path.dirname(target), 'flow.json')
    fs.symlinkSync(target, link)
    rememberWorkflowPath(link)
    const touched = watchDisk()
    const open = vi.spyOn(fs, 'openSync')
    const readWhole = vi.spyOn(fs, 'readFileSync')
    expect(reasonOf(await addFrom(link))).toBe('workflow_file_unreadable')
    expect(touched(target)).toBe(false)
    // Nothing was opened or read by the link's own name, which would reach the target.
    for (const spy of [open, readWhole]) {
      expect(spy.mock.calls.some(([p]) => p === link)).toBe(false)
    }
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })

  it('refuses another path than the one picked', async () => {
    f = makeFixture()
    rememberWorkflowPath(fileWith(fixtureText('picture')))
    const other = fileWith(fixtureText('two-refs'), 'other.json')
    expect(reasonOf(await addFrom(other))).toBe('workflow_not_picked')
  })
})

describe('comfyWorkflow.addFromFile: one handle for the read [D-104, CW-2]', () => {
  it('opens the picked file once without following a link, and reads through that handle', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    rememberWorkflowPath(file)
    const open = vi.spyOn(fs, 'openSync')
    const readWhole = vi.spyOn(fs, 'readFileSync')
    data(await addFrom(file))
    const opens = open.mock.calls.filter(([p]) => p === file)
    expect(opens).toHaveLength(1)
    expect(Number(opens[0]?.[1]) & fs.constants.O_NOFOLLOW).toBe(fs.constants.O_NOFOLLOW)
    expect(readWhole.mock.calls.some(([p]) => p === file)).toBe(false)
  })

  it('refuses a file that is not the one lstat saw', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    const decoy = fileWith(fixtureText('two-refs'), 'decoy.json')
    rememberWorkflowPath(file)
    const decoyStat = fs.lstatSync(decoy)
    const real = fs.lstatSync
    vi.spyOn(fs, 'lstatSync').mockImplementation(((p: fs.PathLike, o?: fs.StatSyncOptions) =>
      p === file ? decoyStat : real(p, o)) as typeof fs.lstatSync)
    expect(reasonOf(await addFrom(file))).toBe('workflow_file_unreadable')
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })
})

describe('comfyWorkflow.addFromFile: the add [D-104, CW-2]', () => {
  it('adds a good file as the person, with the file name as its name', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'))
    rememberWorkflowPath(file)
    const reply = data<ComfyWorkflowAddFromFileReply>(await addFrom(file))
    expect(reply.name).toBe(NAME)
    const entry = f.core.deps.comfyWorkflows.get(reply.workflowId)
    expect(entry?.stored).toMatchObject({ name: NAME, addedBy: 'user' })
    expect(Object.keys(reply).sort()).toEqual(['name', 'workflowId'])
  })

  it('gives a taken name " 2"', async () => {
    f = makeFixture()
    f.core.deps.comfyWorkflows.add({ checked: checked('two-refs'), name: NAME, addedBy: 'user' })
    const file = fileWith(fixtureText('picture'), `${NAME.toUpperCase()}.JSON`)
    rememberWorkflowPath(file)
    expect(data<ComfyWorkflowAddFromFileReply>(await addFrom(file)).name).toBe(
      `${NAME.toUpperCase()} 2`,
    )
  })

  it('cleans the file name and cuts it to 60 characters', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('picture'), `"Sea"${String.fromCharCode(0x202e)}  view ${'x'.repeat(80)}.json`)
    rememberWorkflowPath(file)
    const { name } = data<ComfyWorkflowAddFromFileReply>(await addFrom(file))
    expect(name).toBe(`'Sea' view ${'x'.repeat(49)}`)
    expect([...name]).toHaveLength(60)
  })

  it(`refuses the add after ${MAX_CUSTOM_WORKFLOWS} with workflow_limit`, async () => {
    f = makeFixture()
    for (let i = 0; i < MAX_CUSTOM_WORKFLOWS; i++) {
      f.core.deps.comfyWorkflows.add({ checked: checked('two-refs'), name: `W${i}`, addedBy: 'user' })
    }
    const file = fileWith(fixtureText('picture'))
    rememberWorkflowPath(file)
    expect(reasonOf(await addFrom(file))).toBe('workflow_limit')
  })

  it('refuses a file over 2 MiB before reading it', async () => {
    f = makeFixture()
    const file = fileWith(' '.repeat(MAX_WORKFLOW_BYTES + 1))
    rememberWorkflowPath(file)
    const read = vi.spyOn(fs, 'readFileSync')
    expect(reasonOf(await addFrom(file))).toBe('workflow_too_large')
    expect(read.mock.calls.some(([p]) => p === file)).toBe(false)
  })

  it('refuses a folder or a missing file as unreadable', async () => {
    f = makeFixture()
    const folder = path.join(f.root, 'Downloads.json')
    fs.mkdirSync(folder)
    rememberWorkflowPath(folder)
    expect(reasonOf(await addFrom(folder))).toBe('workflow_file_unreadable')
    const missing = path.join(f.root, 'gone.json')
    rememberWorkflowPath(missing)
    expect(reasonOf(await addFrom(missing))).toBe('workflow_file_unreadable')
  })

  it('refuses a file that fails the checks with its fixed sentence', async () => {
    f = makeFixture()
    const file = fileWith(fixtureText('canvas'))
    rememberWorkflowPath(file)
    expect(reasonOf(await addFrom(file))).toBe('workflow_canvas_format')
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })

  it('puts no path in the reply, a log line or the app.stateChanged payload', async () => {
    f = makeFixture()
    const good = fileWith(fixtureText('picture'))
    rememberWorkflowPath(good)
    const replies = [await addFrom(good)]
    const bad = fileWith(fixtureText('canvas'), 'canvas.json')
    rememberWorkflowPath(bad)
    replies.push(await addFrom(bad), await addFrom(path.join(f.root, 'never-picked.json')))
    const seen = JSON.stringify([replies, f.events]) + f.readLogs()
    expect(seen).not.toContain(f.root)
    expect(seen).not.toContain('Downloads')
    expect(f.events).toContainEqual({ name: 'app.stateChanged', payload: {} })
  })
})
