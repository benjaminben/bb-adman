// P5-1: every Phase 5 command, the sync.preview query and the generative_fill job kind are
// registered (spec/phases/phase-05.md, "Rules for the slices"). Each later slice replaces a
// body and touches no index, so these names stay true once the stubs are gone.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { directionCommands } from '@/main/commands/direction'
import { layerCommands } from '@/main/commands/layer'
import { syncCommands } from '@/main/commands/sync'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { syncQueries } from '@/main/queries/sync'

let f: Fixture
afterEach(() => f.cleanup())

describe('Phase 5 registration [P5-1]', () => {
  it('registers the direction and sync domains', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(directionCommands(deps).map((h) => h.name)).toEqual([
      'direction.createFromMaster',
      'direction.rename',
      'direction.delete',
    ])
    expect(syncCommands(deps).map((h) => h.name)).toEqual(['sync.apply'])
    expect(Object.keys(syncQueries(deps))).toEqual(['sync.preview'])
  })

  it('registers every Phase 5 command and the sync.preview query on core', () => {
    f = makeFixture()
    expect(layerCommands(f.core.deps).map((h) => h.name)).toEqual(
      expect.arrayContaining(['layer.clearOverride', 'layer.revert']),
    )
    expect(f.core.commandNames).toEqual(
      expect.arrayContaining([
        'direction.createFromMaster',
        'direction.rename',
        'direction.delete',
        'variant.fanOut',
        'variant.add',
        'variant.delete',
        'variant.remove',
        'variant.restore',
        'variant.restoreLayers',
        'layer.clearOverride',
        'layer.revert',
        'sync.apply',
        'generation.runFill',
        'generation.applyFill',
      ]),
    )
    expect(f.core.queryNames).toContain('sync.preview')
  })

  it('has a handler for the generative_fill job kind, each kind once', () => {
    const kinds = jobKindHandlers.map((h) => h.kind)
    expect(kinds).toContain('generative_fill')
    expect(new Set(kinds).size).toBe(kinds.length)
  })
})
