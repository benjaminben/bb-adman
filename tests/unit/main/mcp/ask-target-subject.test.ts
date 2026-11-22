// SUBJ-1 (spec/phases/subject-delete.md, D-101): an agent's subject.delete is asked on screen
// as a delete, and its target line names the subject, its photo count and the project. Names
// only: no ID, no path and no photo's file name.
import { afterEach, describe, expect, it } from 'vitest'
import { data, makeFixture, type Fixture } from '../../../integration/core-fixture'
import { agentPolicyFor, AGENT_POLICY } from '@/main/commands/agent-policy'
import { ASK_KINDS } from '@/main/mcp/ask-kinds'
import { askTarget, NO_TARGET } from '@/main/mcp/ask-target'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const PHOTO_PATH = '/Users/someone/Pictures/secret-shoot/tin-front-hero.png'

async function project(): Promise<string> {
  f = makeFixture()
  const { projectId } = data<{ projectId: string }>(
    await f.user('project.create', { name: 'Spring Work', location: f.projectsDir }),
  )
  data(await f.user('subject.create', { projectId, id: 'tea-tin-7', name: 'Tea tin' }))
  return projectId
}

function addPhotos(projectId: string, count: number): void {
  const db = f!.core.projects.requireOpen(projectId).db
  const insert = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES (?, 'asset', 'image', 'imported', 'linked', 'tea-tin-7', 'tin-front-hero.png', ?,
      'tin-front-hero.png', 'image/png', 10, 1, ?, 'x')`,
  )
  for (let i = 0; i < count; i++) insert.run(`photo-${i}`, PHOTO_PATH, `hash-${i}`)
}

const ask = (projectId: string | null, input: unknown) => ({
  command: 'subject.delete',
  agentClient: null,
  projectId,
  input,
})

const lineFor = (projectId: string, subjectId = 'tea-tin-7') =>
  askTarget(f!.core.projects, ask(projectId, { projectId, subjectId }))

describe('subject.delete for an agent [SUBJ-1, D-101]', () => {
  it('is asked, with the action "delete subjects"', () => {
    expect(AGENT_POLICY['subject.delete']).toEqual({ policy: 'ask', action: 'delete subjects' })
    expect(agentPolicyFor('subject.delete')).toBe('ask')
  })

  it('is a delete ask, so the delete tick covers it', () => {
    expect(ASK_KINDS['subject.delete']).toBe('delete')
  })

  it('leaves subject.create and subject.update denied', () => {
    expect(agentPolicyFor('subject.create')).toBe('deny')
    expect(agentPolicyFor('subject.update')).toBe('deny')
    expect(ASK_KINDS['subject.create']).toBeUndefined()
    expect(ASK_KINDS['subject.update']).toBeUndefined()
  })
})

describe('askTarget for subject.delete [SUBJ-1]', () => {
  it.each([
    [0, 'no photos'],
    [1, '1 photo'],
    [3, '3 photos'],
  ])('with %i photos says "%s"', async (count, words) => {
    const projectId = await project()
    addPhotos(projectId, count)
    expect(lineFor(projectId)).toBe(`Subject "Tea tin" (${words}) in "Spring Work"`)
  })

  it('holds no ID, no path and no file name of a photo', async () => {
    const projectId = await project()
    addPhotos(projectId, 2)
    const line = lineFor(projectId)
    for (const word of [projectId, 'tea-tin-7', 'photo-0', PHOTO_PATH, 'tin-front-hero', '/']) {
      expect(line.includes(word), word).toBe(false)
    }
  })

  // The commands refuse such names, so they are planted in the file as an edited file holds them.
  it('cleans the subject and project names', async () => {
    const projectId = await project()
    const db = f!.core.projects.requireOpen(projectId).db
    db.prepare("UPDATE project_meta SET value = ? WHERE key = 'name'").run('Spring\u0007 Work‮')
    db.prepare("UPDATE subject SET name = ? WHERE id = 'tea-tin-7'").run(
      'Tea" (0 photos) in "\ntin',
    )
    expect(lineFor(projectId)).toBe(
      `Subject "Tea' (0 photos) in 'tin" (no photos) in "Spring Work"`,
    )
  })

  it.each([
    ['an unknown subject', { subjectId: 'made-up-subject' }],
    ['an input without the ID', {}],
  ])('gives "Something that no longer exists" for %s', async (_what, extra) => {
    const projectId = await project()
    const line = askTarget(f!.core.projects, ask(projectId, { projectId, ...extra }))
    expect(line).toBe(NO_TARGET)
  })
})
