// A stored key never reaches the log line of a job (SPEC 9.1 1.38, 14 1.40 AA3, review R-04).
// No call leaves the machine: each handler only throws.
import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { listProviders } from '../../../src/main/providers/registry'

// Made up for the test, not the shape of any real key. Its `/`, `+` and `=` make its plain,
// URL-encoded and base64 forms differ.
const KEY = 'made/up+test=value'
const FORMS = [KEY, encodeURIComponent(KEY), Buffer.from(KEY).toString('base64')]
const NAMES = listProviders({}).find((p) => p.id === 'gemini')?.secrets ?? []

const fixtures: RunnerFixture[] = []
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

function fixture(): RunnerFixture {
  const x = makeRunnerFixture({ secrets: Object.fromEntries(NAMES.map((n) => [n, KEY])) })
  fixtures.push(x)
  return x
}

async function failedGeminiLog(x: RunnerFixture): Promise<{ id: string; log: string }> {
  const id = await x.start({ provider: 'gemini' })
  await waitFor(() => x.row(id)?.status === 'failed')
  return { id, log: x.logText() }
}

describe('a stored key never reaches the job log line [SPEC 9.1, 14 1.40 AA3]', () => {
  it('gemini lists the secret names the test fills in', () => {
    expect(NAMES.length).toBeGreaterThan(0)
  })

  it('removes the key from the message of an unforeseen error', async () => {
    const x = fixture()
    x.f.body = async () => {
      throw new Error('failed with ' + KEY)
    }
    const { id, log } = await failedGeminiLog(x)
    expect(log).toContain(id)
    expect(log).toContain('[key removed]')
    for (const form of FORMS) expect(log).not.toContain(form)
  })

  it('removes the key from a frame line of a hand-set stack', async () => {
    const x = fixture()
    x.f.body = async () => {
      const e = new Error('failed')
      e.stack = `Error: failed\n    at run (/app/${KEY}.js:1:2)\n    at next (/app/b.js:3:4)`
      throw e
    }
    const { id, log } = await failedGeminiLog(x)
    expect(log).toContain(id)
    expect(log).toContain('[key removed]')
    for (const form of FORMS) expect(log).not.toContain(form)
  })
})
