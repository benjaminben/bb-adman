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
    for (const list of [devCommands, storageCommands]) {
      expect(list(deps)).toEqual([])
    }
  })

  it('gives an empty query map for each new query domain', () => {
    f = makeFixture()
    const deps = f.core.deps
    for (const map of [campaignQueries]) {
      expect(map(deps)).toEqual({})
    }
  })
})

describe('the asset domain is registered [SPEC 14, Slice A part 2, A2-1]', () => {
  it('gives asset.import, asset.update, asset.relink, asset.remove, asset.checkChanged and asset.addGenerated, in that order', () => {
    f = makeFixture()
    expect(assetCommands(f.core.deps).map((h) => h.name)).toEqual([
      'asset.import',
      'asset.update',
      'asset.relink',
      'asset.remove',
      'asset.checkChanged',
      'asset.addGenerated',
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

describe('the generation domain is registered [SPEC 14 slice H]', () => {
  it('gives generation.runImages only', () => {
    f = makeFixture()
    expect(generationCommands(f.core.deps).map((h) => h.name)).toEqual(['generation.runImages'])
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

describe('the brief domain is registered [SPEC 14, slice C]', () => {
  it('gives brief.parse', () => {
    f = makeFixture()
    expect(briefCommands(f.core.deps).map((h) => h.name)).toEqual(['brief.parse'])
  })
})

describe('the campaign domain is registered [SPEC 14, slice C]', () => {
  it('gives campaign.create, campaign.update and campaign.delete, in that order', () => {
    f = makeFixture()
    expect(campaignCommands(f.core.deps).map((h) => h.name)).toEqual([
      'campaign.create',
      'campaign.update',
      'campaign.delete',
    ])
  })
})

describe('the rule-set domain is registered [SPEC 14, slice C]', () => {
  it('gives ruleSet.update and ruleSet.copyFrom, in that order', () => {
    f = makeFixture()
    expect(ruleSetCommands(f.core.deps).map((h) => h.name)).toEqual([
      'ruleSet.update',
      'ruleSet.copyFrom',
    ])
  })
})

describe('the project and template queries are registered [SPEC 14, slice C]', () => {
  it('gives the project.get query', () => {
    f = makeFixture()
    expect(Object.keys(projectQueries(f.core.deps))).toEqual(['project.get'])
  })

  it('gives the template.list and template.slots queries', () => {
    f = makeFixture()
    expect(Object.keys(templateQueries(f.core.deps))).toEqual(['template.list', 'template.slots'])
  })
})
