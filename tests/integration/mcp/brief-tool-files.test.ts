// R2P-7 (spec/phases/round-2-platform.md, D6 and D7; security class full): a brief that names a
// full file path runs campaign.createFromBriefWithFiles, asked every time with kind import. The
// event holds the count and the target line; the paths reach the window only through
// agent.askFiles. Refuse writes no campaign, subject, asset or copy; allow imports each file
// and attaches it. The text rules refuse before the ask and read no disk. Made-up names only.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import { askLines, riskyKeys } from './ask-fixture'
import { mp4Bytes, pngBytes } from './import-assets-fixture'
import { briefSetUp, markdownBrief, type BriefSetUp } from './brief-tool-fixture'

let x: BriefSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const answer = (s: BriefSetUp, requestId: string, allow: boolean, rememberAuto = false) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto })

type Made = { campaignId: string; subjectIds: string[]; assetIds: string[] }

describe('create_campaign_from_brief with file paths [R2P-7; D6, D7]', () => {
  it('asks with kind import; refuse writes no campaign, subject, asset or copy', async () => {
    x = await briefSetUp()
    const file = x.put('Pictures/citrus-front.png', pngBytes(1))
    const before = { counts: x.counts(), files: x.projectFiles() }
    const pending = x.tool(markdownBrief([file]))
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({
      action: 'make campaigns that import files',
      kind: 'import',
      fileCount: 1,
      target: 'Campaign "Spring Glow launch" with 1 file for its subjects, in "Spring Work"',
    })
    expect(JSON.stringify(asked)).not.toContain(x.dir)
    const shown = await x.core.query(
      'agent.askFiles',
      { requestId: asked.requestId },
      {
        actor: 'user',
      },
    )
    expect(data(shown)).toEqual({ files: [file] })
    data(await answer(x, asked.requestId, false))
    const reply = await pending
    expect(replyJson(reply)).toMatchObject({ code: 'AGENT_REFUSED' })
    expect(x.counts()).toEqual(before.counts)
    expect(x.projectFiles()).toEqual(before.files)
  })

  it('on allow imports each file, attaches it, and gives the IDs only', async () => {
    x = await briefSetUp()
    const front = x.put('Pictures/citrus-front.png', pngBytes(1))
    const side = x.put('Pictures/citrus-side.png', pngBytes(2))
    const known = await x.png('known.png', 3)
    const pending = x.tool(markdownBrief([front, known, side]))
    const asked = await x.nthAsk()
    expect(asked.fileCount).toBe(2)
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    // directionId is the direction's ID ("dir"), as reply-keys.test.ts allows.
    expect(riskyKeys(made)).toEqual(['directionId'])
    expect(made.subjectIds).toEqual(['citrus-glow'])
    expect(made.assetIds).toHaveLength(2)
    const rows = x.rows('SELECT id, subject_id, storage FROM asset WHERE subject_id IS NOT NULL')
    expect(rows.map((r) => r.id).sort()).toEqual([...made.assetIds, known].sort())
    for (const r of rows) expect(r).toMatchObject({ subject_id: 'citrus-glow' })
    const copies = x.rows(`SELECT abs_path FROM asset WHERE id IN ('${made.assetIds.join("','")}')`)
    for (const c of copies)
      expect(path.dirname(String(c.abs_path))).not.toBe(path.join(x.dir, 'Pictures'))
    expect(JSON.stringify(reply)).not.toContain(x.dir)
    expect(JSON.stringify(reply)).not.toContain('citrus-front')
  })

  it('still asks with mcp.autoApproveDestructive on', async () => {
    x = await briefSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const pending = x.tool(markdownBrief([x.put('a.png', pngBytes(1))]))
    const asked = await x.nthAsk()
    expect(asked.kind).toBe('import')
    data(await answer(x, asked.requestId, false))
    expect(replyJson(await pending)).toMatchObject({ code: 'AGENT_REFUSED' })
  })

  it('refuses a file gone after the allow by its place, and writes nothing', async () => {
    x = await briefSetUp()
    const there = x.put('there.png', pngBytes(1))
    const gone = path.join(x.dir, 'gone.png')
    const before = { counts: x.counts(), files: x.projectFiles() }
    const pending = x.tool(markdownBrief([there, gone]))
    data(await answer(x, (await x.nthAsk()).requestId, true))
    expect(replyJson(await pending)).toEqual({
      code: 'NOT_FOUND',
      message: 'File 2 was not found.',
      details: { reason: 'file_not_found' },
    })
    expect(x.counts()).toEqual(before.counts)
    expect(x.projectFiles()).toEqual(before.files)
  })

  it('refuses a file that is already another subject’s photo, and removes the new copy', async () => {
    x = await briefSetUp()
    await x.png('bottle.png', 2, 'bottle')
    const fresh = x.put('fresh.png', pngBytes(1))
    const same = x.put('same-as-bottle.png', pngBytes(2))
    const before = { counts: x.counts(), files: x.projectFiles() }
    const pending = x.tool(markdownBrief([fresh, same], 'ID: can'))
    data(await answer(x, (await x.nthAsk()).requestId, true))
    expect(replyJson(await pending)).toEqual({
      code: 'RULE_VIOLATION',
      message: 'Subject 1, picture 2 is already a photo of another subject.',
      details: { reason: 'photo_of_other_subject' },
    })
    expect(x.counts()).toEqual(before.counts)
    expect(x.projectFiles()).toEqual(before.files)
  })

  it.each([
    [
      'a video file',
      (d: string) => `${d}/clip.mp4`,
      'not_supported',
      'File 1 is not a picture Adman can use.',
    ],
    [
      'a hidden character',
      (d: string) => `${d}/gnp.‮cod.png`,
      'hidden_characters',
      "File 1's path holds hidden characters.",
    ],
  ])('refuses %s before the ask, with no event', async (_n, made, reason, message) => {
    x = await briefSetUp()
    fs.writeFileSync(path.join(x.dir, 'clip.mp4'), mp4Bytes())
    const reply = await x.tool(markdownBrief([made(x.dir)]))
    expect(replyJson(reply)).toEqual({
      code: 'INVALID_INPUT',
      message,
      details: { reason, index: 1 },
    })
    expect(x.asked()).toEqual([])
    expect(JSON.stringify(reply)).not.toContain(x.dir)
  })

  it('refuses more than 20 paths before the ask', async () => {
    x = await briefSetUp()
    const many = Array.from({ length: 21 }, (_, i) => `${x?.dir}/p${i}.png`)
    expect(replyJson(await x.tool(markdownBrief(many)))).toMatchObject({
      code: 'INVALID_INPUT',
      details: { reason: 'too_many_files' },
    })
    expect(x.asked()).toEqual([])
  })

  it('refuses the files command for a brief with no path, with no ask', async () => {
    x = await briefSetUp()
    const reply = await x.agent('campaign.createFromBriefWithFiles', {
      projectId: x.projectId,
      text: markdownBrief([]),
    })
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { reason: 'no_files' } },
    })
    expect(x.asked()).toEqual([])
  })

  it('keeps every path and the brief text out of replies, events and log lines', async () => {
    x = await briefSetUp()
    const file = x.put('Pictures/citrus-front.png', pngBytes(1))
    const pending = x.tool(markdownBrief([file]))
    data(await answer(x, (await x.nthAsk()).requestId, true))
    const reply = await pending
    const events = x.events.filter((e) => e.name !== 'project.changed')
    const seen = JSON.stringify([reply, events]) + x.readLogs()
    for (const words of [x.dir, 'citrus-front', 'Glow that lasts', 'skin care online']) {
      expect(seen).not.toContain(words)
    }
    expect(askLines(x.readLogs()).map((l) => l.message)).toEqual(['allowed'])
  })
})
