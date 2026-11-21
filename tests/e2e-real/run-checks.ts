// SPEC 14 1.59 L-11 (the review's S-3): test:e2e:real refuses to start when something could
// record a typed value. A CLI flag such as `--trace on` or `--reporter html` changes the config
// the global setup is given, and a trace or report keeps each `fill` value, the address and the
// key among them. Playwright's debug logs (DEBUG, PWDEBUG) print them too. Not a test file.

type Mode = string | { mode?: string } | undefined
type Use = { trace?: Mode; screenshot?: Mode; video?: Mode }
export type RunConfig = {
  reporter: ReadonlyArray<readonly [string, unknown?]>
  projects: ReadonlyArray<{ use: Use }>
}

export const RUN_REFUSAL =
  'test:e2e:real runs only with the list reporter, trace, screenshot and video off, ' +
  'and no DEBUG, PWDEBUG or PW_TEST_REPORTER. Run it with no extra flags.'

const isOff = (mode: Mode): boolean =>
  mode === 'off' || (typeof mode === 'object' && mode.mode === 'off')

export function runRefusal(
  config: RunConfig,
  env: Record<string, string | undefined>,
): string | null {
  const listOnly = config.reporter.length === 1 && config.reporter[0]?.[0] === 'list'
  const allOff = config.projects.every(
    ({ use }) => isOff(use.trace) && isOff(use.screenshot) && isOff(use.video),
  )
  // Re-review R-1: a glob such as * or pw* turns on pw:api without naming pw:, so any DEBUG
  // that is not empty is refused.
  const debugLogs = (env.DEBUG ?? '') !== '' || env.PWDEBUG !== undefined
  // Re-review R-2: PW_TEST_REPORTER adds a reporter after the config's own, so it never shows
  // in config.reporter.
  const addedReporter = env.PW_TEST_REPORTER !== undefined
  return listOnly && allOff && !debugLogs && !addedReporter ? null : RUN_REFUSAL
}

// Re-review R-3: UI mode (--ui, --ui-host, --ui-port), the hidden test-server and
// run-test-mcp-server commands, and the editor extension all run tests through Playwright's
// test server, which reloads the config for each run (it can turn on a live trace and add its
// own reporter) after the global setup has passed. The global setup, which runs in the process
// Playwright was started in, therefore accepts only the npm script's own command line.
export const REAL_COMMAND: readonly string[] = ['test', '--config', 'playwright.real.config.ts']

export function commandRefusal(argv: readonly string[]): string | null {
  const args = argv.slice(2)
  const same =
    args.length === REAL_COMMAND.length && args.every((arg, i) => arg === REAL_COMMAND[i])
  return same ? null : RUN_REFUSAL
}

// Set by the global setup only once both checks above pass; each worker inherits it. A worker
// without it ran under a setup that refused or never ran.
export const RUN_CHECKED = 'ADMAN_E2E_RUN_CHECKED'

type WorkerView = {
  config: { reporter: RunConfig['reporter'] }
  project: { use: Use }
}

// The same refusal, run again inside the worker on what the worker was actually given.
export function workerRefusal(
  info: WorkerView,
  env: Record<string, string | undefined>,
): string | null {
  if (env[RUN_CHECKED] !== '1') return RUN_REFUSAL
  return runRefusal({ reporter: info.config.reporter, projects: [{ use: info.project.use }] }, env)
}
