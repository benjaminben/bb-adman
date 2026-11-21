import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { assetCommands } from '../../src/main/commands/asset'
import { briefCommands } from '../../src/main/commands/brief'
import { campaignCommands } from '../../src/main/commands/campaign'
import { devCommands } from '../../src/main/commands/dev'
import { generationCommands } from '../../src/main/commands/generation'
import { jobCommands } from '../../src/main/commands/job'
import { ruleSetCommands } from '../../src/main/commands/rule-set'
import { storageCommands } from '../../src/main/commands/storage'
import { subjectCommands } from '../../src/main/commands/subject'
import { assetQueries } from '../../src/main/queries/asset'
import { campaignQueries } from '../../src/main/queries/campaign'
import { jobQueries } from '../../src/main/queries/job'
import { projectQueries } from '../../src/main/queries/project'
import { templateQueries } from '../../src/main/queries/template'

let f: Fixture
afterEach(() => f.cleanup())

describe('Phase 2 domains are registered empty [SPEC 12, step 0 item 4]', () => {
  it('gives an empty handler list for each new command domain', () => {
    f = makeFixture()
    const deps = f.core.deps
    for (const list of [
      briefCommands,
      campaignCommands,
      devCommands,
      generationCommands,
      ruleSetCommands,
      storageCommands,
    ]) {
      expect(list(deps)).toEqual([])
    }
  })

  it('gives an empty query map for each new query domain', () => {
    f = makeFixture()
    const deps = f.core.deps
    for (const map of [campaignQueries, projectQueries, templateQueries]) {
      expect(map(deps)).toEqual({})
    }
  })
})

describe('the asset domain is registered [SPEC 14, Slice A part 2, A2-1]', () => {
  it('gives asset.import, asset.update, asset.relink, asset.remove and asset.checkChanged, in that order', () => {
    f = makeFixture()
    expect(assetCommands(f.core.deps).map((h) => h.name)).toEqual([
      'asset.import',
      'asset.update',
      'asset.relink',
      'asset.remove',
      'asset.checkChanged',
    ])
  })

  it('gives the asset.list query', () => {
    f = makeFixture()
    expect(Object.keys(assetQueries(f.core.deps))).toEqual(['asset.list'])
  })
})

describe('the job domain is registered [SPEC 14, 1.38 Y12]', () => {
  it('gives job.retry, job.cancel and job.markSeen, in that order', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(jobCommands(deps).map((h) => h.name)).toEqual([
      'job.retry',
      'job.cancel',
      'job.markSeen',
    ])
  })

  it('gives the job.list query', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(Object.keys(jobQueries(deps))).toEqual(['job.list'])
  })
})

describe('the subject domain is registered [SPEC 14, slice C]', () => {
  it('gives subject.create, subject.update and subject.delete, in that order', () => {
    f = makeFixture()
    expect(subjectCommands(f.core.deps).map((h) => h.name)).toEqual([
      'subject.create',
      'subject.update',
      'subject.delete',
    ])
  })
})
