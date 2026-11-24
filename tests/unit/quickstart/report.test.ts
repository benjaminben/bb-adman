import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import type { CheckResult } from '@/shared/checks/types'
import { adLine, adRecord, relativeFolder, reportOf, totalLine } from '../../../quickstart/report'

const PASS: CheckResult = {
  checkId: 'text-colours',
  group: 'brand-legal',
  status: 'pass',
  findings: [],
}
const SKIP: CheckResult = {
  checkId: 'unapproved-translations',
  group: 'readiness',
  status: 'skipped',
  findings: [{ message: 'This post is in the main language.' }],
}
const BANNED: CheckResult = {
  checkId: 'prohibited-words',
  group: 'brand-legal',
  status: 'warn',
  findings: [{ layerId: 'call-to-action', message: 'Call to action contains “billig”.' }],
}
const OVERFLOW: CheckResult = {
  checkId: 'text-overflow',
  group: 'readiness',
  status: 'warn',
  findings: [{ layerId: 'headline', message: 'Headline does not fit its box.' }],
}

const isAscii = (text: string) => [...text].every((c) => c.charCodeAt(0) < 128)

describe('quickstart report', () => {
  it("writes an ad's folder relative to the campaign, with / between parts", () => {
    const campaign = join('out', 'summer-splash')
    expect(relativeFolder(campaign, join(campaign, 'citrus-can', 'de', '16x9'))).toBe(
      'citrus-can/de/16x9',
    )
  })

  it('gives each check its ID, group and state, with its findings or the reason it was skipped', () => {
    const ad = adRecord('de/1x1', [PASS, SKIP, BANNED])
    expect(ad).toEqual({
      folder: 'de/1x1',
      checks: [
        { id: 'text-colours', group: 'brand-legal', state: 'passed' },
        {
          id: 'unapproved-translations',
          group: 'readiness',
          state: 'skipped',
          reason: 'This post is in the main language.',
        },
        {
          id: 'prohibited-words',
          group: 'brand-legal',
          state: 'flagged',
          findings: ['Call to action contains "billig".'],
        },
      ],
    })
  })

  it('prints one plain line per ad: all passed, or its flags', () => {
    expect(adLine(adRecord('en/1x1', [PASS, SKIP]), 12)).toBe('  en/1x1        all checks passed')
    const line = adLine(adRecord('de/16x9', [PASS, BANNED, OVERFLOW]), 12)
    expect(line).toBe(
      '  de/16x9       flagged: Call to action contains "billig". Headline does not fit its box.',
    )
    expect(isAscii(line)).toBe(true)
  })

  it('prints a one-line total', () => {
    const ads = [adRecord('a', [PASS]), adRecord('b', [BANNED]), adRecord('c', [SKIP])]
    expect(totalLine(ads)).toBe('3 ads: 2 passed every check, 1 flagged.')
    expect(totalLine([adRecord('a', [PASS])])).toBe('1 ad: 1 passed every check, 0 flagged.')
  })

  it('holds the models, notes, sets and ads, and no key', () => {
    const report = reportOf({
      models: { image: 'fake-image', text: 'fake-text' },
      notes: ['The photo "x.png" was not found. It is left out.'],
      sets: [
        {
          name: 'Citrus can',
          prompt: 'A can',
          pictures: [
            { from: 'given', file: 'citrus-can.png' },
            { from: 'made', size: '1x1' },
          ],
          calls: [{ kind: 'picture', ms: 12 }],
        },
      ],
      ads: [adRecord('citrus-can/en/1x1', [PASS])],
    })
    expect(Object.keys(report)).toEqual(['models', 'notes', 'sets', 'ads'])
    expect(report.sets[0]?.pictures[0]).toEqual({ from: 'given', file: 'citrus-can.png' })
    expect(JSON.stringify(report)).not.toMatch(/key/i)
  })
})
