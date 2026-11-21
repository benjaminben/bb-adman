import { describe, it, expect } from 'vitest'
import { runRefusal, RUN_REFUSAL, type RunConfig } from '../../e2e-real/run-checks'

const OFF = { trace: 'off', screenshot: 'off', video: 'off' }
const safe: RunConfig = { reporter: [['list', null]], projects: [{ use: OFF }] }

describe('test:e2e:real runs only when nothing can record a typed value [SPEC 14 1.59 L-11, S-3]', () => {
  it('runs with the list reporter only and everything off', () => {
    expect(runRefusal(safe, {})).toBeNull()
  })

  it('accepts a mode object that says off', () => {
    const use = { trace: { mode: 'off' }, screenshot: { mode: 'off' }, video: { mode: 'off' } }
    expect(runRefusal({ ...safe, projects: [{ use }] }, {})).toBeNull()
  })

  it('refuses any other reporter, alone or beside list', () => {
    expect(runRefusal({ ...safe, reporter: [['html']] }, {})).toBe(RUN_REFUSAL)
    expect(runRefusal({ ...safe, reporter: [['list'], ['json']] }, {})).toBe(RUN_REFUSAL)
    expect(runRefusal({ ...safe, reporter: [] }, {})).toBe(RUN_REFUSAL)
  })

  it('refuses a trace, a screenshot or a video that is not off, in any project', () => {
    const refused = (projects: RunConfig['projects']) => runRefusal({ ...safe, projects }, {})
    for (const key of ['trace', 'screenshot', 'video'] as const) {
      const on = { ...OFF, [key]: 'on' }
      expect(refused([{ use: on }])).toBe(RUN_REFUSAL)
      expect(refused([{ use: OFF }, { use: on }])).toBe(RUN_REFUSAL)
      expect(refused([{ use: { ...OFF, [key]: { mode: 'on' } } }])).toBe(RUN_REFUSAL)
    }
  })

  it('refuses a missing setting rather than guess it is off', () => {
    expect(runRefusal({ ...safe, projects: [{ use: { trace: 'off' } }] }, {})).toBe(RUN_REFUSAL)
  })

  it("refuses Playwright's debug logs: DEBUG naming pw: or PWDEBUG set", () => {
    expect(runRefusal(safe, { DEBUG: 'pw:api' })).toBe(RUN_REFUSAL)
    expect(runRefusal(safe, { DEBUG: 'other,pw:browser*' })).toBe(RUN_REFUSAL)
    expect(runRefusal(safe, { PWDEBUG: '1' })).toBe(RUN_REFUSAL)
    expect(runRefusal(safe, { PWDEBUG: '' })).toBe(RUN_REFUSAL)
  })

  // Re-review R-1: a glob such as * or pw* turns on pw:api without naming pw:, so any
  // DEBUG that is set and not empty is refused. Empty or unset turns on no log.
  it('refuses any DEBUG that is set and not empty [R-1]', () => {
    for (const value of ['*', 'pw*', 'pw:api', '*api', 'vite:*', 'unrelated']) {
      expect(runRefusal(safe, { DEBUG: value })).toBe(RUN_REFUSAL)
    }
    expect(runRefusal(safe, { DEBUG: '' })).toBeNull()
    expect(runRefusal(safe, { DEBUG: undefined })).toBeNull()
  })

  it('the refusal is one fixed sentence that names no value', () => {
    expect(RUN_REFUSAL).toBe(
      'test:e2e:real runs only with the list reporter, trace, screenshot and video off, ' +
        'and no DEBUG or PWDEBUG. Run it with no extra flags.',
    )
  })
})
