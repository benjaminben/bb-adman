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
      jobCommands,
      ruleSetCommands,
      storageCommands,
      subjectCommands,
    ]) {
      expect(list(deps)).toEqual([])
    }
  })

  it('gives an empty query map for each new query domain', () => {
    f = makeFixture()
    const deps = f.core.deps
    for (const map of [campaignQueries, jobQueries, projectQueries, templateQueries]) {
      expect(map(deps)).toEqual({})
    }
  })
})

describe('the asset domain is registered [SPEC 14, Slice A part 2, A2-1]', () => {
  it('gives asset.import, asset.update and asset.remove, in that order', () => {
    f = makeFixture()
    expect(assetCommands(f.core.deps).map((h) => h.name)).toEqual([
      'asset.import',
      'asset.update',
      'asset.relink',
      'asset.remove',
    ])
  })

  it('gives the asset.list query', () => {
    f = makeFixture()
    expect(Object.keys(assetQueries(f.core.deps))).toEqual(['asset.list'])
  })
})
