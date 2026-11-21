import { describe, it, expect } from 'vitest'
import {
  commandRefusal,
  runRefusal,
  workerRefusal,
  REAL_COMMAND,
  RUN_CHECKED,
  RUN_REFUSAL,
  type RunConfig,
} from '../../e2e-real/run-checks'

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

  // Re-review R-2: PW_TEST_REPORTER adds a reporter after the config's own, so it is never in
  // config.reporter and must be refused on its own.
  it('refuses PW_TEST_REPORTER when it is set [R-2]', () => {
    for (const value of ['html', './my-reporter.js', '']) {
      expect(runRefusal(safe, { PW_TEST_REPORTER: value })).toBe(RUN_REFUSAL)
    }
  })

  it('the refusal is one fixed sentence that names no value', () => {
    expect(RUN_REFUSAL).toBe(
      'test:e2e:real runs only with the list reporter, trace, screenshot and video off, ' +
        'and no DEBUG, PWDEBUG or PW_TEST_REPORTER. Run it with no extra flags.',
    )
  })
})

// Re-review R-3: UI mode, watch tools and the editor extension run tests through Playwright's
// test server, which reloads the config per run (trace on, its own reporter) after the global
// setup has passed. The setup accepts only the npm script's own command line, and each test
// checks again what its worker was given.
describe('test:e2e:real refuses a test-server run and checks again in the worker [R-3]', () => {
  const node = ['/usr/bin/node', '/x/node_modules/playwright/cli.js']

  it("accepts only the npm script's command line", () => {
    expect(commandRefusal([...node, ...REAL_COMMAND])).toBeNull()
    expect(REAL_COMMAND).toEqual(['test', '--config', 'playwright.real.config.ts'])
  })

  it('refuses UI mode, the test server, the MCP test server and any extra argument', () => {
    for (const extra of [
      ['--ui'],
      ['--ui-port=0'],
      ['--ui-host', 'localhost'],
      ['--debug'],
      ['-g', 'x'],
    ]) {
      expect(commandRefusal([...node, ...REAL_COMMAND, ...extra])).toBe(RUN_REFUSAL)
    }
    for (const command of ['test-server', 'run-test-mcp-server']) {
      expect(commandRefusal([...node, command, '-c', 'playwright.real.config.ts'])).toBe(
        RUN_REFUSAL,
      )
    }
    expect(commandRefusal(['/electron', '/extension-host.js'])).toBe(RUN_REFUSAL)
    expect(commandRefusal([])).toBe(RUN_REFUSAL)
  })

  const checked = { [RUN_CHECKED]: '1' }
  const view = (use: object, reporter: RunConfig['reporter'] = [['list', null]]) => ({
    config: { reporter },
    project: { use },
  })

  it('a worker runs only after the global setup passed and with nothing recording', () => {
    expect(workerRefusal(view(OFF), checked)).toBeNull()
    expect(workerRefusal(view(OFF), {})).toBe(RUN_REFUSAL)
    expect(workerRefusal(view(OFF), { [RUN_CHECKED]: '' })).toBe(RUN_REFUSAL)
  })

  it("a worker refuses the test server's live trace, another reporter or a debug log", () => {
    const liveTrace = { ...OFF, trace: { mode: 'on', sources: false, live: true } }
    expect(workerRefusal(view(liveTrace), checked)).toBe(RUN_REFUSAL)
    expect(workerRefusal(view({ ...OFF, video: 'on' }), checked)).toBe(RUN_REFUSAL)
    expect(workerRefusal(view(OFF, [['html']]), checked)).toBe(RUN_REFUSAL)
    expect(workerRefusal(view(OFF), { ...checked, DEBUG: '*' })).toBe(RUN_REFUSAL)
    expect(workerRefusal(view(OFF), { ...checked, PW_TEST_REPORTER: 'html' })).toBe(RUN_REFUSAL)
  })
})
