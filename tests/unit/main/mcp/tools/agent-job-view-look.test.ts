// R2E-3 (spec/phases/round-2-editor.md D3; security class short): an agent's view of a layout
// box gains boxColor, boxPadding and typeStyle, each only as a plain value of its kind, so an
// agent can put the same look with update_layers. Nothing else of a box leaves.
import { describe, it, expect } from 'vitest'
import { agentJobView } from '@/main/mcp/tools/agent-job-view'
import type { JobRow } from '@/shared/schemas/rows/job'

const PROVIDERS = [{ id: 'gemini', label: 'Google Gemini' }]

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

const PLANTED = {
  prompt: 'made-up prompt sent',
  model: 'made-up-model',
  request: { prompt: 'made-up request' },
}

function run(result: unknown) {
  const row: JobRow = {
    id: 'j1',
    kind: 'layout_proposal',
    status: 'succeeded',
    campaignId: 'c1',
    variantId: 'v1',
    layerId: null,
    slot: null,
    provider: 'gemini',
    model: 'made-up-model',
    request: { prompt: 'made-up request' },
    remoteJobId: null,
    result,
    errorKind: null,
    progress: 1,
    paidCalls: 1,
    seenAt: null,
    startedBy: 'agent',
    errorReason: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:01Z',
  }
  return agentJobView(row, PROVIDERS)
}

describe('agentJobView layout box look fields [R2E-3, D3]', () => {
  it('adds boxColor, boxPadding and typeStyle to a box, and nothing else of it', () => {
    const look = { boxColor: '#000000', boxPadding: 12, typeStyle: 'black-caps', readable: 'box' }
    const planted = { ...BOX, ...look, fontAssetId: 'a-font', path: '/Users/someone/f.woff2' }
    const view = run({ boxes: [planted], ...PLANTED })
    expect(view.layout?.boxes).toEqual([
      { ...BOX, boxColor: '#000000', boxPadding: 12, typeStyle: 'black-caps' },
    ])
    const text = JSON.stringify(view)
    for (const word of ['made-up', '/Users/someone', 'a-font', '"readable"', '"fontAssetId"']) {
      expect(text, word).not.toContain(word)
    }
  })

  it('shows a null typeStyle as null, and leaves the fields out of a box without them', () => {
    expect(run({ boxes: [{ ...BOX, typeStyle: null }] }).layout?.boxes).toEqual([
      { ...BOX, typeStyle: null },
    ])
    const [plain] = run({ boxes: [BOX] }).layout?.boxes ?? []
    expect(Object.keys(plain ?? {}).sort()).toEqual(Object.keys(BOX).sort())
  })

  it.each([
    ['a boxColor that is not #RRGGBB', { boxColor: 'url(/Users/someone/x.png)' }, 'boxColor'],
    ['a boxColor that is not text', { boxColor: 7 }, 'boxColor'],
    ['a boxPadding that is not a whole number', { boxPadding: 2.5 }, 'boxPadding'],
    ['a negative boxPadding', { boxPadding: -1 }, 'boxPadding'],
    ['a boxPadding that is text', { boxPadding: '12' }, 'boxPadding'],
    ['a typeStyle outside the five', { typeStyle: '/Users/someone/font.ttf' }, 'typeStyle'],
    ['a typeStyle that is not text', { typeStyle: { id: 'bold' } }, 'typeStyle'],
  ])('leaves out %s and keeps the box', (_case, bad, field) => {
    const [box] = run({ boxes: [{ ...BOX, ...bad }] }).layout?.boxes ?? []
    expect(box).toEqual(BOX)
    expect(box).not.toHaveProperty(field)
  })
})
