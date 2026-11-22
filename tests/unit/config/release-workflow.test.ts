// The tag pipeline (spec/infra-and-settings.md, "CI pipeline"; spec/phases/phase-11.md, P11-3):
// what .github/workflows/release.yml may and may not do. Read as data, never run here.
import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parse } from 'yaml'

type Step = { run?: string; uses?: string; env?: Record<string, string>; if?: string }
type Job = {
  needs?: string[]
  permissions?: Record<string, string>
  steps: Step[]
  'continue-on-error'?: boolean
}
type Workflow = {
  on: { push?: { tags?: string[]; branches?: string[] } } & Record<string, unknown>
  permissions: Record<string, string>
  jobs: Record<string, Job>
}

const text = fs.readFileSync('.github/workflows/release.yml', 'utf8')
const workflow = parse(text) as Workflow
const jobs = Object.entries(workflow.jobs)
const runs = (job: Job) => job.steps.flatMap((s) => (s.run === undefined ? [] : [s.run]))
const allRuns = jobs.flatMap(([, job]) => runs(job))

describe('the release workflow', () => {
  it('starts only on a pushed tag v*', () => {
    expect(Object.keys(workflow.on)).toEqual(['push'])
    expect(workflow.on.push).toEqual({ tags: ['v*'] })
  })

  it('reads the repository by default; only the release job may write', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
    for (const [name, job] of jobs) {
      if (name === 'release') expect(job.permissions).toEqual({ contents: 'write' })
      else expect(job.permissions).toBeUndefined()
    }
  })

  it('the job that may write checks out and runs no code from the repository', () => {
    const release = workflow.jobs.release!
    expect(release.steps.some((s) => s.uses?.startsWith('actions/checkout'))).toBe(false)
    expect(runs(release).join('\n')).not.toMatch(/npm |npx |node /)
  })

  it('uses no secret but the run token', () => {
    const named = [...text.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
    expect(new Set(named)).toEqual(new Set(['GITHUB_TOKEN']))
  })

  it('fails on an advisory at high severity and lets no step fail quietly', () => {
    expect(runs(workflow.jobs.audit!)).toContain('npm audit --audit-level=high')
    expect(text).not.toMatch(/continue-on-error/)
  })

  it('checks that the tag says the version of package.json', () => {
    expect(runs(workflow.jobs.audit!).join('\n')).toMatch(
      /require\('\.\/package\.json'\)\.version.*\$GITHUB_REF_NAME/,
    )
  })

  it('packages for macOS arm64 and Windows x64, never publishing from the builder', () => {
    const builder = allRuns.filter((r) => r.includes('electron-builder'))
    expect(builder).toHaveLength(1)
    expect(builder[0]).toMatch(/--publish never$/)
    expect(text).toMatch(/builder: --mac dmg --arm64\n/)
    expect(text).toMatch(/builder: --win nsis --x64\n/)
    expect(text).not.toMatch(/npm run package/)
  })

  it('fetches FFmpeg before it packages, and tests the built page', () => {
    const steps = runs(workflow.jobs.package!)
    const at = (part: string) => steps.findIndex((r) => r.includes(part))
    expect(at('npm run fetch:ffmpeg')).toBeGreaterThan(at('npm ci'))
    expect(at('electron-builder')).toBeGreaterThan(at('npm run fetch:ffmpeg'))
    expect(at('electron-builder')).toBeGreaterThan(at('npm run test:build'))
  })

  it('makes a draft release, after the audit and both packages', () => {
    const release = workflow.jobs.release!
    expect(release.needs).toEqual(['audit', 'package'])
    const made = runs(release).filter((r) => r.includes('gh release'))
    expect(made).toHaveLength(1)
    expect(made[0]).toMatch(/gh release create "\$GITHUB_REF_NAME"/)
    expect(made[0]).toMatch(/--draft/)
  })

  it('names no paid or real-server test run', () => {
    expect(text).not.toMatch(/test:live|test:comfy|test:e2e:real|approvals-local/)
  })

  it('electron-builder has no publish target of its own', () => {
    const config = JSON.parse(fs.readFileSync('electron-builder.json', 'utf8')) as {
      publish?: unknown
    }
    expect(config.publish).toBeNull()
  })
})
