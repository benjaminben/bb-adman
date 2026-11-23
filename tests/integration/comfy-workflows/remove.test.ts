import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checked } from './store-fixture'

let f: Fixture
afterEach(() => f.cleanup())

const add = (name: string) =>
  f.core.deps.comfyWorkflows.add({ checked: checked('two-refs'), name, addedBy: 'user' }).stored.id
const remove = (workflowId: unknown) => f.user('comfyWorkflow.remove', { workflowId })
const folder = () => path.join(f.userData, 'comfy-workflows')

// Every file under a folder, so a test sees any delete anywhere in it. The log folder is left
// out: the command's own log line may make it.
const allFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'logs')
    .flatMap((e) =>
      e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
    )
    .sort()

describe('comfyWorkflow.remove [D-104, CW-2, security rule 10]', () => {
  it('deletes exactly one file, and replies with the ID', async () => {
    f = makeFixture()
    const a = add('A')
    const b = add('B')
    const before = allFiles(f.userData)
    expect(data(await remove(a))).toEqual({ workflowId: a })
    expect(allFiles(f.userData)).toEqual(before.filter((p) => p !== path.join(folder(), `${a}.json`)))
    expect(fs.readdirSync(folder())).toEqual([`${b}.json`])
    expect(f.core.deps.comfyWorkflows.get(a)).toBeUndefined()
  })

  it.each([
    'custom-../../x',
    'custom-../settings',
    '../settings.json',
    'moss-text-to-image',
    'custom-0123456789AB',
    'custom-0123456789a',
  ])('refuses %s with INVALID_INPUT and deletes nothing', async (workflowId) => {
    f = makeFixture()
    add('A')
    fs.writeFileSync(path.join(f.root, 'x.json'), '{}')
    fs.writeFileSync(path.join(f.root, 'x'), '{}')
    const before = allFiles(f.root)
    expect(await remove(workflowId)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(allFiles(f.root)).toEqual(before)
  })

  it('refuses an unknown ID with NOT_FOUND and deletes nothing', async () => {
    f = makeFixture()
    add('A')
    const before = allFiles(f.userData)
    expect(await remove('custom-0123456789ab')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That workflow is not on this computer.' },
    })
    expect(allFiles(f.userData)).toEqual(before)
  })

  it('is gone after a restart', async () => {
    f = makeFixture()
    const a = add('A')
    data(await remove(a))
    f.restart()
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })
})
