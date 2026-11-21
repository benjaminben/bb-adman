// SPEC 14 1.59 L-11 (the review's S-3): test:e2e:real refuses to start when something could
// record a typed value. A CLI flag such as `--trace on` or `--reporter html` changes the config
// the global setup is given, and a trace or report keeps each `fill` value, the address and the
// key among them. Playwright's debug logs (DEBUG=pw:*, PWDEBUG) print them too. Not a test file.

type Mode = string | { mode?: string } | undefined
type Use = { trace?: Mode; screenshot?: Mode; video?: Mode }
export type RunConfig = {
  reporter: ReadonlyArray<readonly [string, unknown?]>
  projects: ReadonlyArray<{ use: Use }>
}

export const RUN_REFUSAL =
  'test:e2e:real runs only with the list reporter, trace, screenshot and video off, ' +
  'and no DEBUG=pw: or PWDEBUG. Run it with no extra flags.'

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
  const debugLogs = (env.DEBUG ?? '').includes('pw:') || env.PWDEBUG !== undefined
  return listOnly && allOff && !debugLogs ? null : RUN_REFUSAL
}
