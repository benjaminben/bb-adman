import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

// Read as text: importing a Playwright config here would run it (SPEC 13, the 1.10 rules).
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}
const offlineText = fs.readFileSync('playwright.config.ts', 'utf8')
const realText = fs.readFileSync('playwright.real.config.ts', 'utf8')
const setupText = fs.readFileSync('tests/e2e-real/global-setup.ts', 'utf8')
const ciText = fs.readFileSync('.github/workflows/ci.yml', 'utf8')

describe('test:e2e stays offline and test:e2e:real is its own run [SPEC 14 1.56 E2E-R]', () => {
  it('has both scripts as the spec gives them', () => {
    expect(pkg.scripts['test:e2e']).toBe('npm run build && playwright test')
    expect(pkg.scripts['test:e2e:real']).toBe(
      'npm run build && playwright test --config playwright.real.config.ts',
    )
  })

  it('no other script names the real config or tests/e2e-real', () => {
    const others = Object.entries(pkg.scripts).filter(([name]) => name !== 'test:e2e:real')
    for (const [, line] of others) {
      expect(line).not.toContain('playwright.real.config')
      expect(line).not.toContain('e2e-real')
    }
  })

  it('no CI workflow names the real script, its config or its folder', () => {
    expect(ciText).not.toContain('test:e2e:real')
    expect(ciText).not.toContain('playwright.real.config')
    expect(ciText).not.toContain('e2e-real')
  })

  it('the offline config reads tests/e2e only, so tests/e2e-real is left out', () => {
    expect(offlineText).toContain("testDir: 'tests/e2e',")
    expect(offlineText).not.toContain('e2e-real')
  })

  it('the real config reads tests/e2e-real only', () => {
    expect(realText).toContain("testDir: 'tests/e2e-real',")
  })
})

describe('the real config keeps nothing that could hold the address or a path [SPEC 14 1.56]', () => {
  it('one worker and no retries', () => {
    expect(realText).toContain('workers: 1,')
    expect(realText).toContain('retries: 0,')
  })

  it('traces, screenshots and video are all off', () => {
    expect(realText).toContain("trace: 'off'")
    expect(realText).toContain("screenshot: 'off'")
    expect(realText).toContain("video: 'off'")
  })

  it('the list reporter only, so no HTML report keeps attachments', () => {
    expect(realText).toContain("reporter: 'list',")
    expect(realText).not.toMatch(/html|json|junit|blob/)
  })

  it('loading the config reads nothing: .env.local is read only inside the setup function', () => {
    expect(realText).not.toMatch(/readFileSync|process\.env|\.env\.local/)
    expect(realText).toContain("globalSetup: './tests/e2e-real/global-setup.ts'")
    expect(setupText).toContain('export default function')
    const top = setupText.slice(0, setupText.indexOf('export default function'))
    const outside = top.replace(/function readEnvLocal\(\)[\s\S]*?\n}\n/, '')
    expect(outside).not.toMatch(/readFileSync|process\.env/)
  })

  it('takes COMFY_BASE_URL only from the file, through the comfy picker', () => {
    expect(setupText).toContain('comfyEnvFrom(')
    expect(setupText).not.toMatch(/LIVE_ENV_NAMES|liveEnvFrom|GEMINI_API_KEY|ADMAN_E2E_/)
  })

  it("turns off Playwright's page snapshot, which would draw the address into a file", () => {
    expect(setupText).toContain("process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'")
  })
})
