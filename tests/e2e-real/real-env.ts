// SPEC 14 1.56 E2E-R, "Launch": the environment of the app that launchReal starts. No fake
// providers, the hand-test tools on (an unpackaged launch, so trial workflows are offered to
// the user), the sandbox app data folder. The address, the Gemini key, the photo paths and
// the switches belong to the test only: the app is not handed them.
type Env = Record<string, string | undefined>

const TEST_ONLY = ['ADMAN_FAKE_PROVIDERS', 'COMFY_BASE_URL', 'GEMINI_API_KEY']

function testOnly(name: string): boolean {
  return TEST_ONLY.includes(name) || name.startsWith('ADMAN_E2E_')
}

export function realAppEnv(env: Env, userData: string): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !testOnly(name)) kept[name] = value
  }
  return { ...kept, ADMAN_DEV_TOOLS: '1', ADMAN_USER_DATA_DIR: userData }
}
