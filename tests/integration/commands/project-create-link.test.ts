// R2P-8 (spec/phases/round-2-platform.md, D8): createProjectFile looks at the entry itself, not
// where it leads. The user's project.create refuses any entry at the name, a link that leads
// nowhere included, and never makes the link's target.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

const FILE_EXISTS = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'A file with this name already exists in that folder.',
    details: { reason: 'file_exists' },
  },
}

describe('project.create and an entry already at the name [R2P-8, D8]', () => {
  it('refuses a link that leads nowhere and does not make its target', async () => {
    f = makeFixture()
    const target = path.join(f.root, 'elsewhere', 'Summer.adman')
    fs.mkdirSync(path.dirname(target))
    fs.symlinkSync(target, path.join(f.projectsDir, 'Summer.adman'))
    const reply = await f.user('project.create', { name: 'Summer', location: f.projectsDir })
    expect(reply).toEqual(FILE_EXISTS)
    expect(fs.existsSync(target)).toBe(false)
    expect(fs.lstatSync(path.join(f.projectsDir, 'Summer.adman')).isSymbolicLink()).toBe(true)
    expect(f.core.projects.all()).toEqual([])
  })

  it('refuses a link to a file and leaves that file as it was', async () => {
    f = makeFixture()
    const target = path.join(f.root, 'notes.txt')
    fs.writeFileSync(target, 'made-up notes')
    fs.symlinkSync(target, path.join(f.projectsDir, 'Summer.adman'))
    const reply = await f.user('project.create', { name: 'Summer', location: f.projectsDir })
    expect(reply).toEqual(FILE_EXISTS)
    expect(fs.readFileSync(target, 'utf8')).toBe('made-up notes')
  })

  it('refuses a folder at the name', async () => {
    f = makeFixture()
    fs.mkdirSync(path.join(f.projectsDir, 'Summer.adman'))
    const reply = await f.user('project.create', { name: 'Summer', location: f.projectsDir })
    expect(reply).toEqual(FILE_EXISTS)
    expect(fs.readdirSync(path.join(f.projectsDir, 'Summer.adman'))).toEqual([])
  })
})
