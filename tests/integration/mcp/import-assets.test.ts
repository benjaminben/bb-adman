// R2P-5 (spec/phases/round-2-platform.md, D5 and D7; security class full): import_assets asks
// the user every time, with the full paths reachable only through the user-only agent.askFiles.
// Allow imports and replies the IDs in order; refuse, time-out and busy import nothing; auto-
// approve never answers an import; the text rules refuse before any event.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import {
  importSetUp,
  mp4Bytes,
  pngBytes,
  ttfBytes,
  type ImportSetUp,
} from './import-assets-fixture'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'

let x: ImportSetUp | undefined
afterEach(async () => {
  vi.useRealTimers()
  await x?.close()
  x = undefined
})

const answer = (s: ImportSetUp, requestId: string, allow: boolean, rememberAuto = false) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto })

const askFiles = (s: ImportSetUp, requestId: string, actor: 'user' | 'agent' = 'user') =>
  s.core.query('agent.askFiles', { requestId }, { actor })

const threeFiles = (s: ImportSetUp) => [
  s.put('Pictures/hero.png', pngBytes(1)),
  s.put('Movies/clip.mp4', mp4Bytes()),
  s.put('Fonts/Made Up Sans.ttf', ttfBytes()),
]

const call = (s: ImportSetUp, paths: unknown, library = 'asset') =>
  s.session().then((t) => t.call('import_assets', { project_id: s.projectId, paths, library }))

describe('import_assets through the ask [R2P-5; D5, D7]', () => {
  it('asks with kind import and the count; allow copies the three files and gives their IDs', async () => {
    x = await importSetUp()
    const paths = threeFiles(x)
    const before = x.projectFiles()
    const pending = call(x, paths)
    const asked = await x.nthAsk()
    expect(Object.keys(asked).sort()).toEqual(
      ['action', 'agentClient', 'expiresAt', 'fileCount', 'kind', 'requestId', 'target'].sort(),
    )
    expect(asked).toMatchObject({
      action: 'import files',
      kind: 'import',
      fileCount: 3,
      target: '3 files into "Spring Work"',
    })
    expect(x.projectFiles()).toEqual(before)
    expect(data(await askFiles(x, asked.requestId))).toEqual({ files: paths })
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    const { assetIds } = replyJson<{ assetIds: string[] }>(reply)
    const rows = x.assetRows()
    expect(rows.map((r) => r.id)).toEqual(assetIds)
    expect(rows.map((r) => [r.kind, r.origin, r.storage, r.subject_id, r.library])).toEqual([
      ['image', 'imported', 'managed', null, 'asset'],
      ['video', 'imported', 'managed', null, 'asset'],
      ['font', 'imported', 'managed', null, 'asset'],
    ])
    expect(rows.map((r) => r.display_name)).toEqual(['hero.png', 'clip.mp4', 'Made Up Sans.ttf'])
    expect(x.projectFiles()).toHaveLength(before.length + 3)
    for (const r of rows) expect(path.dirname(String(r.abs_path))).not.toBe(x.dir)
    expect(await askFiles(x, asked.requestId)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('imports into the reference library when asked', async () => {
    x = await importSetUp()
    const pending = call(x, [x.put('ref.png', pngBytes(2))], 'reference')
    const asked = await x.nthAsk()
    expect(asked.target).toBe('1 file into "Spring Work"')
    data(await answer(x, asked.requestId, true))
    expect((await pending).isError).toBeFalsy()
    expect(x.assetRows().map((r) => r.library)).toEqual(['reference'])
  })

  it('refuse imports nothing and leaves the project folder as it was', async () => {
    x = await importSetUp()
    const before = x.projectFiles()
    const pending = call(x, threeFiles(x))
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, false, true))
    expect(replyJson(await pending)).toMatchObject({ code: 'AGENT_REFUSED' })
    expect(x.projectFiles()).toEqual(before)
    expect(x.assetRows()).toEqual([])
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
  })

  it('times out at two minutes and imports nothing', async () => {
    x = await importSetUp()
    const paths = threeFiles(x)
    const before = x.projectFiles()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const pending = x.agent('asset.importFiles', { projectId: x.projectId, paths })
    const asked = await x.nthAsk()
    vi.advanceTimersByTime(ASK_WAIT_MS)
    expect(await pending).toMatchObject({ ok: false, error: { details: { reason: 'timed_out' } } })
    expect(await askFiles(x, asked.requestId)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(x.projectFiles()).toEqual(before)
  })

  it('is busy while another ask waits, and imports nothing', async () => {
    x = await importSetUp()
    const first = x.agent('campaign.delete', { projectId: x.projectId, campaignId: x.campaignId })
    const asked = await x.nthAsk()
    const before = x.projectFiles()
    const busy = await x.agent('asset.importFiles', {
      projectId: x.projectId,
      paths: threeFiles(x),
    })
    expect(busy).toMatchObject({ ok: false, error: { details: { reason: 'busy' } } })
    expect(x.asked()).toHaveLength(1)
    expect(x.projectFiles()).toEqual(before)
    data(await answer(x, asked.requestId, false))
    await first
  })

  it('still asks with mcp.autoApproveDestructive on, which answers deletes only', async () => {
    x = await importSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const pending = x.agent('asset.importFiles', { projectId: x.projectId, paths: threeFiles(x) })
    const asked = await x.nthAsk()
    expect(asked.kind).toBe('import')
    data(await answer(x, asked.requestId, false))
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(x.assetRows()).toEqual([])
    const deleted = await x.agent('campaign.delete', {
      projectId: x.projectId,
      campaignId: x.campaignId,
    })
    expect(deleted.ok).toBe(true)
    expect(x.asked()).toHaveLength(1)
  })
})

describe('agent.askFiles [R2P-5; D7]', () => {
  it('is denied to an agent while the request is open, and gives nothing away', async () => {
    x = await importSetUp()
    const paths = threeFiles(x)
    const pending = x.agent('asset.importFiles', { projectId: x.projectId, paths })
    const asked = await x.nthAsk()
    const denied = await askFiles(x, asked.requestId, 'agent')
    expect(denied).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(denied)).not.toContain(x.dir)
    expect(await askFiles(x, 'made-up-request')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    })
    data(await answer(x, asked.requestId, false))
    await pending
  })
})

describe('the text rules refuse before the ask [R2P-5; D5]', () => {
  it.each([
    [
      '21 paths',
      (d: string) => Array.from({ length: 21 }, (_, i) => `${d}/p${i}.png`),
      'too_many_files',
    ],
    ['a relative path', () => ['Pictures/hero.png'], 'not_full_path'],
    ['a path holding U+202E', (d: string) => [`${d}/gnp.‮cod.png`], 'hidden_characters'],
    ['a text file', (d: string) => [`${d}/notes.txt`], 'not_supported'],
  ])('refuses %s with INVALID_INPUT and sends no event', async (_name, paths, reason) => {
    x = await importSetUp()
    const given = paths(x.dir)
    const reply = await call(x, given)
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'INVALID_INPUT', details: { reason } })
    expect(x.asked()).toEqual([])
    expect(JSON.stringify(reply)).not.toContain(x.dir)
  })

  it('sends the same event for a missing file and an existing one; only the allow tells', async () => {
    x = await importSetUp()
    const real = x.put('hero.png', pngBytes(3))
    const missing = path.join(x.dir, 'gone.png')
    const shown = (a: object) => ({ ...a, requestId: '', expiresAt: '' })
    const one = x.agent('asset.importFiles', { projectId: x.projectId, paths: [real] })
    const first = await x.nthAsk(1)
    data(await answer(x, first.requestId, false))
    const r1 = await one
    const two = x.agent('asset.importFiles', { projectId: x.projectId, paths: [missing] })
    const second = await x.nthAsk(2)
    expect(shown(second)).toEqual(shown(first))
    data(await answer(x, second.requestId, false))
    expect(await two).toEqual(r1)
    const three = x.agent('asset.importFiles', { projectId: x.projectId, paths: [missing] })
    data(await answer(x, (await x.nthAsk(3)).requestId, true))
    expect(await three).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'File 1 was not found.',
        details: { reason: 'file_not_found' },
      },
    })
    expect(fs.existsSync(missing)).toBe(false)
  })
})
