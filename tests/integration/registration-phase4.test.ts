// P4-1: every Phase 4 command, job kind and query is registered (spec/phases/phase-04.md,
// "Rules for these slices"). Each later slice replaces a body and touches no index, so these
// names stay true once the stubs are gone.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { JOB_KINDS } from '@/shared/config/job-kinds'

let f: Fixture
afterEach(() => f.cleanup())

describe('Phase 4 registration [P4-1]', () => {
  it('registers the five Phase 4 commands', () => {
    f = makeFixture()
    expect(f.core.commandNames).toEqual(
      expect.arrayContaining([
        'generation.proposeLayout',
        'generation.copyOptions',
        'generation.cutOut',
        'brief.extract',
        'layer.updateMany',
      ]),
    )
  })

  it('registers the three Phase 4 queries', () => {
    f = makeFixture()
    expect(f.core.queryNames).toEqual(
      expect.arrayContaining(['job.earlierOptions', 'job.activity', 'campaign.paidCount']),
    )
  })

  it('has a handler for each Phase 4 job kind, each kind once', () => {
    const kinds = jobKindHandlers.map((h) => h.kind)
    const phase4 = ['layout_proposal', 'copy_options', 'brief_extraction', 'cutout'] as const
    expect(kinds).toEqual(expect.arrayContaining([...phase4]))
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(kinds.every((k) => JOB_KINDS.includes(k))).toBe(true)
  })
})
