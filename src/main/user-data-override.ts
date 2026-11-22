// ADMAN_USER_DATA_DIR (spec/infra-and-settings.md): the app data folder for a test run of an
// unpackaged app. A packaged app ignores it, so nothing in a user's environment can point the
// installed app at another folder of settings and secrets. Null keeps Electron's own folder.
export function userDataOverride(
  env: Record<string, string | undefined>,
  isPackaged: boolean,
): string | null {
  const value = env.ADMAN_USER_DATA_DIR
  return !isPackaged && value ? value : null
}
