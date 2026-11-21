import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { readJobErrorDetail } from '../../../src/main/db/rows'

const fixtures: RunnerFixture[] = []
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

describe('the log line of an unforeseen job error [SPEC 9.1 1.38, 14 1.38 Y9]', () => {
  it('for ComfyUI holds the job ID and the error name, and no message', async () => {
    const x = makeRunnerFixture()
    fixtures.push(x)
    x.f.body = async () => {
      throw new Error('MARKER 10.1.2.3:8188')
    }
    const id = await x.start({ provider: 'comfyui' })
    await waitFor(() => x.row(id)?.status === 'failed')
    const log = x.logText()
    expect(log).toContain(id)
    expect(log).toContain('"name":"Error"')
    expect(log).not.toContain('MARKER')
    expect(log).not.toContain('10.1.2.3')
    expect(readJobErrorDetail(x.project.db, id)).toBe('internal')
  })
})
