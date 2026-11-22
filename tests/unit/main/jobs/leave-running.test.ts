// P7-13 (A-174): which rows a close leaves running, and that an agent sees nothing of the run
// it carries (no remote ID, no provider).
import { describe, expect, it } from 'vitest'
import { leftRunningOnClose } from '@/main/jobs/leave-running'
import { agentJobView } from '@/main/mcp/tools/agent-job-view'
import { JOB_KINDS } from '@/shared/config/job-kinds'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

const CHARGES: ProviderInfo = {
  id: 'charge-test',
  label: 'Charge Test',
  jobs: ['video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: false,
  cancel: 'may_finish',
  serverText: false,
}

const LEFT = {
  id: 'j1',
  kind: 'video_generation',
  status: 'running',
  provider: CHARGES.id,
  remoteJobId: 'r-secret-1',
  result: { stage: 'working', leftRunning: true },
} as unknown as JobRow

describe('leftRunningOnClose [P7-13]', () => {
  it('holds for a started paid may_finish video run', () => {
    expect(leftRunningOnClose(LEFT, CHARGES)).toBe(true)
  })

  it.each([
    ['waiting', { ...LEFT, result: { stage: 'waiting' } }, CHARGES],
    ['no stage', { ...LEFT, result: null }, CHARGES],
    ['no remote ID', { ...LEFT, remoteJobId: null }, CHARGES],
    ['queued', { ...LEFT, status: 'queued' }, CHARGES],
    ['ended', { ...LEFT, status: 'succeeded' }, CHARGES],
    ['local provider', LEFT, { ...CHARGES, local: true }],
    ['provider that stops', LEFT, { ...CHARGES, cancel: 'stops' }],
    ['provider with no cancel', LEFT, { ...CHARGES, cancel: 'none' }],
    ['provider not in the registry', LEFT, undefined],
    ...JOB_KINDS.filter((k) => k !== 'video_generation').map(
      (kind) => [kind, { ...LEFT, kind }, CHARGES] as const,
    ),
  ] as [string, JobRow, ProviderInfo | undefined][])('not for %s', (_name, row, provider) => {
    expect(leftRunningOnClose(row, provider)).toBe(false)
  })
})

describe('an agent sees nothing of a left-running run [P7-13, FR-198]', () => {
  it('leaves out the remote ID, the provider and leftRunning', () => {
    const view = agentJobView({ ...LEFT, campaignId: 'c1' } as JobRow, [CHARGES])
    const text = JSON.stringify(view)
    expect(text).not.toContain('r-secret-1')
    expect(text).not.toContain(CHARGES.id)
    expect(text).not.toContain('leftRunning')
    expect(view).toMatchObject({ status: 'running', stage: 'working' })
  })
})
