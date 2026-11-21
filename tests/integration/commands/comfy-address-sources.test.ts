import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import Database from 'better-sqlite3'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '@/shared/schemas/queries/app'

type Opened = { projectId: string; filePath: string }
type Packed = { packagePath: string }

const OURS = 'http://192.168.1.20:8188'
const THEIRS = 'http://192.168.1.99:8188'
const HOSTILE = 'http://169.254.169.254'

const fixtures: Fixture[] = []
function fixture(): Fixture {
  const f = makeFixture()
  fixtures.push(f)
  return f
}
afterEach(() => {
  vi.restoreAllMocks()
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const settingsOf = async (f: Fixture) =>
  data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' })).settings
const fileOf = (f: Fixture) => fs.readFileSync(path.join(f.userData, 'settings.json'), 'utf8')

// A project and its package made on another computer, whose own app has another address.
// The project file and the package folder also carry an address in places no reader uses.
async function madeElsewhere(): Promise<{ project: string; packaged: string }> {
  const other = fixture()
  data(await other.user('comfy.setAddress', { address: THEIRS }))
  const created = data<Opened>(
    await other.user('project.create', { name: 'Elsewhere', location: other.projectsDir }),
  )
  const target = path.join(other.root, 'out')
  fs.mkdirSync(target)
  const packed = data<Packed>(
    await other.user('project.package', { projectId: created.projectId, targetDir: target }),
  )
  data(await other.user('project.close', { projectId: created.projectId }))
  const packagedFile = fs.readdirSync(packed.packagePath).find((n) => n.endsWith('.adman'))
  const packaged = path.join(packed.packagePath, packagedFile ?? '')
  for (const file of [created.filePath, packaged]) {
    const db = new Database(file)
    db.prepare('INSERT INTO project_meta (key, value) VALUES (?, ?)').run(
      'comfyui.baseUrl',
      HOSTILE,
    )
    db.close()
  }
  const planted = { comfyui: { baseUrl: HOSTILE }, agentRuns: { comfyui: { allowed: true } } }
  fs.writeFileSync(path.join(packed.packagePath, 'settings.json'), JSON.stringify(planted))
  return { project: created.filePath, packaged }
}

describe('only comfy.setAddress sets the address [FR-273, SPEC 6.10.1, 14 CU-1]', () => {
  it('opening a project and a package made elsewhere leaves the address unchanged and sends nothing', async () => {
    const { project, packaged } = await madeElsewhere()
    const f = fixture()
    data(await f.user('comfy.setAddress', { address: OURS }))
    const before = fileOf(f)
    const connect = vi.spyOn(net.Socket.prototype, 'connect')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (const filePath of [project, packaged]) {
      const opened = data<Opened>(await f.user('project.open', { filePath }))
      expect((await settingsOf(f)).comfyui).toEqual({ baseUrl: OURS })
      data(await f.user('project.close', { projectId: opened.projectId }))
    }
    const after = await settingsOf(f)
    expect(after.comfyui).toEqual({ baseUrl: OURS })
    expect(after.agentRuns).toEqual({})
    expect(JSON.parse(fileOf(f)).comfyui).toEqual(JSON.parse(before).comfyui)
    expect(fileOf(f)).not.toContain(HOSTILE)
    expect(connect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('opening a project made elsewhere sets no address when none is saved', async () => {
    const { packaged } = await madeElsewhere()
    const f = fixture()
    const opened = data<Opened>(await f.user('project.open', { filePath: packaged }))
    data(await f.user('project.close', { projectId: opened.projectId }))
    expect((await settingsOf(f)).comfyui).toEqual({ baseUrl: null })
  })
})

describe('settings.update cannot write comfyui or agentRuns [SPEC 6.10.1, 13.1, 14 CU-1]', () => {
  it.each([
    { comfyui: { baseUrl: THEIRS } },
    { comfyui: { baseUrl: null } },
    { agentRuns: { comfyui: { allowed: true } } },
    { generation: { optionsPerRun: 3 }, comfyui: { baseUrl: THEIRS } },
  ])('refuses %j and leaves a saved address and the file as they were', async (patch) => {
    const f = fixture()
    data(await f.user('comfy.setAddress', { address: OURS }))
    const before = fileOf(f)
    expect(await f.user('settings.update', patch)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(fileOf(f)).toBe(before)
    expect((await settingsOf(f)).comfyui).toEqual({ baseUrl: OURS })
  })
})
