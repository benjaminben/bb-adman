// SPEC 13 ADMAN_DEV_TOOLS: the hand-test tools are on only in an unpackaged app started
// with the variable set to 1. A packaged app ignores it.
export function devToolsEnabled(
  isPackaged: boolean,
  env: Record<string, string | undefined>,
): boolean {
  return !isPackaged && env.ADMAN_DEV_TOOLS === '1'
}
