// P10-10, security class full: create_campaign's brief is an agent's untrusted text and never
// makes the app read a file. A path, a file name, a file: address or an adman-asset:// address
// in the brief's sizes, its subjects' pictures, the rule set or the subject map is never opened
// or looked up on disk; nothing of the file and no path the app knows reaches the reply, an
// event, a log line or the stored brief. A required asset is an asset ID of this project only.
// No run is started and nothing is sent to a provider, even with agent runs allowed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { insertAsset } from '../row-fixtures'
import { replyJson, type ToolReply } from './tool-client'
import { askSetUp, type AskSetUp } from './ask-fixture'
import { runSetUp, type RunSetUp } from './run-tools-fixture'

let x: AskSetUp | undefined
let r: RunSetUp | undefined
let outside: string | undefined
afterEach(async () => {
  vi.restoreAllMocks()
  syncBuiltinESMExports()
  await x?.close()
  await r?.close()
  if (outside) fs.rmSync(outside, { recursive: true, force: true })
  x = r = outside = undefined
})

const CONTENTS = 'PRIVATE-CONTENTS-7731'

// A real file outside every project, named by the agent.
function outsideFile(): string {
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
  const file = path.join(outside, 'private-note.png')
  fs.writeFileSync(file, CONTENTS)
  return file
}

type Fn = (...a: unknown[]) => unknown
const FS_CALLS = ['readFileSync', 'readFile', 'openSync', 'open', 'statSync', 'stat', 'lstatSync']
  .concat(['lstat', 'existsSync', 'accessSync', 'access', 'createReadStream', 'realpathSync'])
  .concat(['realpath', 'copyFileSync', 'copyFile', 'readdirSync', 'readdir', 'cp', 'cpSync'])

// Every fs call from here on, in core and in this test; the named exports follow the spies.
function watchFs() {
  const spies: Array<{ mock: { calls: unknown[][] } }> = []
  for (const target of [fs, fs.promises] as unknown as Array<Record<string, Fn>>) {
    for (const name of FS_CALLS) {
      if (typeof target[name] === 'function') spies.push(vi.spyOn(target, name))
    }
  }
  syncBuiltinESMExports()
  return (marker: string) =>
    spies.flatMap((s) => s.mock.calls).filter((a) => a.some((v) => String(v).includes(marker)))
}

function args(s: { projectId: string }, extra: Record<string, unknown> = {}) {
  const input = createInput()
  return {
    project_id: s.projectId,
    brief: input.brief,
    subject_map: input.subjectMap.map((m) => ({ ...m, create: false })),
    template_id: input.templateId,
    ...extra,
  }
}

const storedBriefs = (s: AskSetUp) =>
  s.core.projects.requireOpen(s.projectId).db.prepare('SELECT brief FROM campaign').all() as {
    brief: string
  }[]

const text = (reply: ToolReply) => JSON.stringify(reply)

describe('create_campaign never follows a path an agent names [security]', () => {
  it('skips paths and addresses in the brief sizes and drops subject pictures', async () => {
    const file = outsideFile()
    x = await askSetUp()
    const s = await x.session()
    const input = createInput()
    const brief = {
      ...input.brief,
      sizes: [file, `file://${file}`, 'adman-asset://private-note', '../../private-note.png'],
      subjects: input.brief.subjects.map((b) => ({ ...b, pictures: [file, `file://${file}`] })),
    }
    const touched = watchFs()
    const reply = await s.call('create_campaign', args(x, { brief }))
    expect(touched(path.basename(outside ?? ''))).toEqual([])
    expect(touched('private-note')).toEqual([])
    vi.restoreAllMocks()
    syncBuiltinESMExports()
    expect(reply.isError).toBeFalsy()
    expect(Object.keys(replyJson(reply)).sort()).toEqual(['campaignId', 'directionId', 'variantId'])
    for (const word of [file, 'private-note', 'adman-asset', 'file:', CONTENTS, os.tmpdir()]) {
      expect(text(reply)).not.toContain(word)
      expect(x.readLogs()).not.toContain(word)
    }
    const events = JSON.stringify(x.events)
    expect(events).not.toContain(CONTENTS)
    expect(events).not.toContain('pictures')
    const agentBrief = storedBriefs(x)[1]?.brief ?? ''
    expect(agentBrief).not.toContain('pictures')
    expect(agentBrief).not.toContain(CONTENTS)
  })

  const assetCases: Array<[string, (file: string) => string]> = [
    ['a path', (file) => file],
    ['a file: address', (file) => `file://${file}`],
    ['an adman-asset:// address', () => 'adman-asset://private-note'],
    ['an asset ID of another project', () => 'other-photo'],
  ]

  it.each(assetCases)('refuses %s as a required asset, and makes nothing', async (_n, id) => {
    const file = outsideFile()
    x = await askSetUp()
    const s = await x.session()
    const other = data<{ projectId: string }>(
      await x.user('project.create', { name: 'Other Work', location: outside }),
    )
    insertAsset(x.core.projects.requireOpen(other.projectId).db, { id: 'other-photo' })
    const ruleSet = { requiredAssetIds: [id(file)], palette: [], requiredWords: {} }
    const touched = watchFs()
    const reply = await s.call(
      'create_campaign',
      args(x, { rule_set: { ...ruleSet, prohibitedWords: {} } }),
    )
    expect(touched('private-note')).toEqual([])
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'NOT_FOUND' })
    expect(text(reply)).not.toContain('private-note')
    expect(text(reply)).not.toContain(os.tmpdir())
    expect(storedBriefs(x)).toHaveLength(1)
  })

  it.each([true, false])('refuses a path as a subject ID (create %s)', async (create) => {
    const file = outsideFile()
    x = await askSetUp()
    const s = await x.session()
    const subject_map = [
      { subjectId: file, create },
      { subjectId: 'bottle', create: false },
    ]
    const touched = watchFs()
    const reply = await s.call('create_campaign', args(x, { subject_map }))
    expect(touched('private-note')).toEqual([])
    expect(reply.isError).toBe(true)
    expect(text(reply)).not.toContain('private-note')
    expect(storedBriefs(x)).toHaveLength(1)
  })
})

describe('create_campaign starts no run [security, spec/agent-runs.md]', () => {
  it('sends nothing to a provider and makes no job, with agent runs allowed', async () => {
    r = await runSetUp()
    const db = r.f.core.projects.requireOpen(r.projectId).db
    const jobs = () => (db.prepare('SELECT COUNT(*) AS n FROM job').get() as { n: number }).n
    const before = { seen: r.stand.seen.length, jobs: jobs() }
    const input = createInput()
    const reply = await r.s.call('create_campaign', {
      project_id: r.projectId,
      brief: input.brief,
      subject_map: [
        { subjectId: 'flask', create: true },
        { subjectId: 'kettle', create: true },
      ],
      template_id: input.templateId,
    })
    expect(reply.isError).toBeFalsy()
    expect({ seen: r.stand.seen.length, jobs: jobs() }).toEqual(before)
  })
})
