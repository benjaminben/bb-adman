import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { assetCommands } from '@/main/commands/asset'
import { briefCommands } from '@/main/commands/brief'
import { campaignCommands } from '@/main/commands/campaign'
import { devCommands } from '@/main/commands/dev'
import { generationCommands } from '@/main/commands/generation'
import { jobCommands } from '@/main/commands/job'
import { ruleSetCommands } from '@/main/commands/rule-set'
import { subjectCommands } from '@/main/commands/subject'
import { assetQueries } from '@/main/queries/asset'
import { campaignQueries } from '@/main/queries/campaign'
import { jobQueries } from '@/main/queries/job'
import { projectQueries } from '@/main/queries/project'
import { templateQueries } from '@/main/queries/template'

let f: Fixture
afterEach(() => f.cleanup())

describe('Phase 2 domains are registered empty [SPEC 12, step 0 item 4]', () => {
  it('gives an empty handler list for each new command domain', () => {
    f = makeFixture()
    const deps = f.core.deps
    for (const list of [devCommands]) {
      expect(list(deps)).toEqual([])
    }
  })

  it('gives the campaign.get query', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(Object.keys(campaignQueries(deps))).toEqual(['campaign.get'])
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
  it('gives generation.runImages and generation.startVideo', () => {
    f = makeFixture()
    expect(generationCommands(f.core.deps).map((h) => h.name)).toEqual([
      'generation.runImages',
      'generation.startVideo',
      'generation.proposeLayout',
      'generation.copyOptions',
      'generation.cutOut',
    ])
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
    expect(briefCommands(f.core.deps).map((h) => h.name)).toEqual(['brief.parse', 'brief.extract'])
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
