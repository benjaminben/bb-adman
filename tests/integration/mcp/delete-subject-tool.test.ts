// SUBJ-1 (spec/phases/subject-delete.md, D-101): an agent's delete_subject asks the user and
// waits. Allow deletes the subject row only, and its photos keep their rows; refuse and
// time-out run nothing; the user's own delete tick skips the ask. The reply is the subject ID
// only, and no ask, reply, event or log line holds a path or a photo's file name.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import { askSetUp, type AskSetUp } from './ask-fixture'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'

let x: AskSetUp | undefined
afterEach(async () => {
  vi.useRealTimers()
  await x?.close()
  x = undefined
})

const SUBJECT = 'tea-tin-7'
const PHOTO_NAME = 'tin-front-hero.png'
const PHOTO_PATH = `/Users/someone/Pictures/secret-shoot/${PHOTO_NAME}`
const IN_USE = 'This subject is used by a campaign. Remove it from every campaign first.'
const REFUSED = {
  ok: false,
  error: {
    code: 'AGENT_REFUSED',
    message: 'The user did not allow this action.',
    details: { reason: 'refused' },
  },
}

// One project with a campaign (which uses "can"), and a subject no campaign uses with two photos.
async function setUp(): Promise<AskSetUp> {
  const s = await askSetUp()
  data(await s.user('subject.create', { projectId: s.projectId, id: SUBJECT, name: 'Tea tin' }))
  const db = s.core.projects.requireOpen(s.projectId).db
  const insert = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES (?, 'asset', 'image', 'imported', 'linked', ?, ?, ?, ?, 'image/png', 10, 1, ?, 'x')`,
  )
  for (const id of ['photo-1', 'photo-2']) {
    insert.run(id, SUBJECT, PHOTO_NAME, PHOTO_PATH, PHOTO_NAME, `hash-${id}`)
  }
  return s
}

const db = (s: AskSetUp) => s.core.projects.requireOpen(s.projectId).db
const subjectExists = (s: AskSetUp, id = SUBJECT) =>
  Boolean(db(s).prepare('SELECT 1 FROM subject WHERE id = ?').get(id))
const photos = (s: AskSetUp) =>
  db(s).prepare("SELECT id, subject_id AS subjectId FROM asset WHERE id LIKE 'photo-%'").all()

const answer = (s: AskSetUp, requestId: string, allow: boolean) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto: false })

const args = (s: AskSetUp, subjectId = SUBJECT) => ({
  project_id: s.projectId,
  subject_id: subjectId,
})

function holdsNoPath(text: string) {
  for (const word of [PHOTO_PATH, PHOTO_NAME, 'secret-shoot', 'photo-1']) {
    expect(text.includes(word), `${word} found`).toBe(false)
  }
}

describe('delete_subject over MCP [SUBJ-1, D-101]', () => {
  it('asks with the subject line; allow deletes the subject and its photos keep their rows', async () => {
    x = await setUp()
    const s = await x.session()
    const from = x.events.length
    const pending = s.call('delete_subject', args(x))
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({
      kind: 'delete',
      action: 'delete subjects',
      target: 'Subject "Tea tin" (2 photos) in "Spring Work"',
    })
    holdsNoPath(JSON.stringify({ ...asked, requestId: '' }))
    for (const id of [SUBJECT, x.projectId]) expect(JSON.stringify(asked)).not.toContain(id)
    expect(subjectExists(x)).toBe(true)
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ subjectId: SUBJECT })
    expect(subjectExists(x)).toBe(false)
    expect(photos(x)).toEqual([
      { id: 'photo-1', subjectId: null },
      { id: 'photo-2', subjectId: null },
    ])
    // The agent's events and the log. project.changed carries the window its rows, as for
    // every change a person makes, and is not the agent's.
    const agentEvents = x.events.slice(from).filter((e) => e.name.startsWith('agent.'))
    expect(agentEvents.map((e) => e.name)).toContain('agent.activity')
    holdsNoPath(JSON.stringify([reply, agentEvents, x.readLogs()]))
  })

  it('refused by the user, deletes nothing and gives the refusal only', async () => {
    x = await setUp()
    const s = await x.session()
    const pending = s.call('delete_subject', args(x))
    data(await answer(x, (await x.nthAsk()).requestId, false))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(REFUSED.error)
    expect(subjectExists(x)).toBe(true)
    expect(photos(x)).toEqual([
      { id: 'photo-1', subjectId: SUBJECT },
      { id: 'photo-2', subjectId: SUBJECT },
    ])
  })

  it('runs nothing when the user does not answer in two minutes', async () => {
    x = await setUp()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const pending = x.agent('subject.delete', { projectId: x.projectId, subjectId: SUBJECT })
    await x.nthAsk()
    vi.advanceTimersByTime(ASK_WAIT_MS)
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(subjectExists(x)).toBe(true)
  })

  it('is not asked when the user ticked "Don\'t ask again for deletes"', async () => {
    x = await setUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const s = await x.session()
    expect(replyJson(await s.call('delete_subject', args(x)))).toEqual({ subjectId: SUBJECT })
    expect(x.asked()).toEqual([])
    expect(subjectExists(x)).toBe(false)
  })

  it('a subject a campaign uses is refused by the command after the allow, and stays', async () => {
    x = await setUp()
    const s = await x.session()
    const pending = s.call('delete_subject', args(x, 'can'))
    data(await answer(x, (await x.nthAsk()).requestId, true))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'RULE_VIOLATION', message: IN_USE })
    holdsNoPath(JSON.stringify(reply))
    expect(subjectExists(x, 'can')).toBe(true)
  })

  it('says what it does, that it cannot be undone and that the user is asked', async () => {
    x = await setUp()
    const s = await x.session()
    const tool = (await s.list()).find((t) => t.name === 'delete_subject')
    expect(tool?.description).toBe(
      'Delete a subject of an open project. Its photos stay in the project without a ' +
        'subject. A subject that a campaign uses cannot be deleted. This cannot be undone. ' +
        'The user is asked in the app, and this call waits up to two minutes for the answer. ' +
        'A refusal is final: do not ask again for the same subject unless the user tells you to.',
    )
  })
})
