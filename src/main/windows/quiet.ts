// Quiet windows, for test runs only: with ADMAN_QUIET_WINDOWS=1 in an unpackaged app, the app
// window is never shown and the app never comes to the front, so tests do not take over the
// screen of a person working on the same machine. A packaged app ignores it. It changes only
// how windows are shown, never a window's security settings.
export function quietWindows(
  env: Record<string, string | undefined>,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env.ADMAN_QUIET_WINDOWS === '1'
}
