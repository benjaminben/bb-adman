// P10-12 (security review of P10-5; security class full): the bounds agentJobView puts on what an
// AI run gives an agent. A layout box keeps a null colour, its align is one of the three and its
// colour a 6-digit hex; copy options are no more than a run can ask for, each cut to 200
// characters. New cases beside agent-job-view.test.ts, which is at its line limit.
import { describe, it, expect } from 'vitest'
import { agentJobView } from '@/main/mcp/tools/agent-job-view'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import type { JobRow } from '@/shared/schemas/rows/job'

const BOX = {
  slot: 'headline',
  x: 10,
  y: 20,
  width: 300,
  height: 80,
  fontSize: 48,
  align: 'center',
  color: '#FFFFFF',
}

function run(kind: JobRow['kind'], result: unknown) {
  const row: JobRow = {
    id: 'j1',
    kind,
    status: 'succeeded',
    campaignId: 'c1',
    variantId: 'v1',
    layerId: 'l1',
    slot: null,
    provider: 'fake',
    model: null,
    request: {},
    remoteJobId: null,
    result,
    errorKind: null,
    progress: 1,
    paidCalls: 0,
    seenAt: null,
    startedBy: 'agent',
    errorReason: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:01Z',
  }
  return agentJobView(row, [{ id: 'fake', label: 'Fake provider' }])
}

describe('agentJobView bounds for the AI runs [P10-12, review of P10-5] (security class)', () => {
  it('keeps a layout box whose color is null', () => {
    const plain = { ...BOX, color: null }
    expect(run('layout_proposal', { boxes: [plain, BOX] }).layout).toEqual({ boxes: [plain, BOX] })
  })

  it('drops a box whose align is not left, center or right, or whose color is not a 6-digit hex', () => {
    const good = ['left', 'center', 'right'].map((align) => ({ ...BOX, align, color: '#a1B2c3' }))
    const bad = [
      { ...BOX, align: 'justify' },
      { ...BOX, align: 'Center' },
      { ...BOX, color: 'red' },
      { ...BOX, color: '#FFF' },
      { ...BOX, color: '#FFFFFFFF' },
      { ...BOX, color: '#GGGGGG' },
      { ...BOX, color: ' #FFFFFF' },
      { ...BOX, color: `#FFFFFF ${'x'.repeat(500)}` },
    ]
    expect(run('layout_proposal', { boxes: [...bad, ...good] }).layout).toEqual({ boxes: good })
  })

  it('keeps no more copy options than the most a run can ask for, each cut to 200 characters', () => {
    const long = 'Ü'.repeat(260)
    const options = Array.from({ length: MAX_COPY_OPTIONS + 5 }, (_, i) =>
      i === 0 ? long : `O${i}`,
    )
    const view = run('copy_options', { options })
    expect(view.copyOptions).toHaveLength(MAX_COPY_OPTIONS)
    expect(view.copyOptions?.[0]).toBe('Ü'.repeat(200))
    expect(view.copyOptions?.slice(1)).toEqual(options.slice(1, MAX_COPY_OPTIONS))
  })

  it('cuts an option in code points, so a cut never splits a character', () => {
    const view = run('copy_options', { options: ['\u{1F600}'.repeat(201)] })
    expect([...(view.copyOptions?.[0] ?? '')]).toHaveLength(200)
  })
})
