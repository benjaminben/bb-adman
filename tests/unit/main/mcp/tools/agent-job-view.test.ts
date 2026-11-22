// MCP-D agentJobView (security class): what an agent sees of a job row. Built by naming the
// fields that go out, so a column added to the row later does not leave with it.
import { describe, it, expect } from 'vitest'
import { agentJobView } from '@/main/mcp/tools/agent-job-view'
import { plainMessage } from '@/shared/providers/messages'
import type { JobRow } from '@/shared/schemas/rows/job'

const PROVIDERS = [
  { id: 'comfyui', label: 'ComfyUI' },
  { id: 'gemini', label: 'Google Gemini' },
]

const ORIGIN = 'http://127.0.0.1:8188'

// A row with every column filled, the hidden ones holding words that must not leave.
function fullRow(over: Partial<JobRow> = {}): JobRow {
  return {
    id: 'j1',
    kind: 'image_generation',
    status: 'running',
    campaignId: 'c1',
    variantId: 'v1',
    layerId: 'l1',
    slot: 'background',
    provider: 'comfyui',
    model: 'secret-model-name.safetensors',
    request: { prompt: 'A can', referencePath: '/Users/someone/picture.png' },
    remoteJobId: 'remote-prompt-id',
    result: {
      assetIds: ['a1', 'a2'],
      failures: { offline: 1 },
      stage: 'waiting',
      queuePosition: 3,
      missingItems: [{ what: 'model', name: 'made-up-model.safetensors' }],
      serverAddress: ORIGIN,
    },
    errorKind: 'offline',
    progress: 0.5,
    paidCalls: 2,
    seenAt: '2026-01-01T00:00:02Z',
    startedBy: 'agent',
    errorReason: 'no_answer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:01Z',
    ...over,
  }
}

const SHOWN = [
  'id',
  'kind',
  'status',
  'startedBy',
  'campaignId',
  'variantId',
  'layerId',
  'slot',
  'progress',
  'paidCalls',
  'seenAt',
  'errorKind',
  'errorReason',
  'createdAt',
  'updatedAt',
  'stage',
  'queuePosition',
  'assetIds',
  'failures',
  'message',
]

describe('agentJobView [MCP-D; FR-198] (security class)', () => {
  it('gives exactly the allowed keys for a picture job with every column filled', () => {
    const view = agentJobView(fullRow(), PROVIDERS)
    expect(Object.keys(view).sort()).toEqual([...SHOWN].sort())
    expect(view).toMatchObject({
      id: 'j1',
      kind: 'image_generation',
      status: 'running',
      startedBy: 'agent',
      campaignId: 'c1',
      variantId: 'v1',
      layerId: 'l1',
      slot: 'background',
      progress: 0.5,
      paidCalls: 2,
      seenAt: '2026-01-01T00:00:02Z',
      errorKind: 'offline',
      errorReason: 'no_answer',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:01Z',
      stage: 'waiting',
      queuePosition: 3,
      assetIds: ['a1', 'a2'],
      failures: { offline: 1 },
    })
  })

  it('leaves out provider, model, remoteJobId, request and the rest of result', () => {
    const text = JSON.stringify(agentJobView(fullRow(), PROVIDERS))
    for (const hidden of [
      'secret-model-name',
      'remote-prompt-id',
      'referencePath',
      '/Users/someone',
      'made-up-model',
      'missingItems',
      ORIGIN,
      '"provider"',
      '"model"',
      '"request"',
      '"result"',
    ]) {
      expect(text, hidden).not.toContain(hidden)
    }
  })

  it('does not pass on a column added to the row later', () => {
    const later = { ...fullRow(), filePath: '/Users/someone/project.adman' } as JobRow
    const view = agentJobView(later, PROVIDERS)
    expect(Object.keys(view).sort()).toEqual([...SHOWN].sort())
    expect(JSON.stringify(view)).not.toContain('/Users/someone')
  })

  it('gives stage only when a string and queuePosition only when a whole number', () => {
    const view = agentJobView(fullRow({ result: { stage: 4, queuePosition: 1.5 } }), PROVIDERS)
    expect(view).not.toHaveProperty('stage')
    expect(view).not.toHaveProperty('queuePosition')
    const text = agentJobView(fullRow({ result: { stage: { a: 1 }, queuePosition: '2' } }), [])
    expect(text).not.toHaveProperty('stage')
    expect(text).not.toHaveProperty('queuePosition')
  })

  it('gives the picture asset IDs as strings only, and [] for a result that is not an object', () => {
    const mixed = agentJobView(fullRow({ result: { assetIds: ['a1', 7, null, 'a2'] } }), [])
    expect(mixed.assetIds).toEqual(['a1', 'a2'])
    expect(agentJobView(fullRow({ result: null }), []).assetIds).toEqual([])
    expect(agentJobView(fullRow({ result: 'a1' }), []).assetIds).toEqual([])
    expect(agentJobView(fullRow({ result: { assetIds: 'a1' } }), []).assetIds).toEqual([])
  })

  it('gives [result.assetId] for a video job and no failures', () => {
    const video = fullRow({ kind: 'video_generation', result: { assetId: 'v-a1', fps: 24 } })
    const view = agentJobView(video, PROVIDERS)
    expect(view.assetIds).toEqual(['v-a1'])
    expect(view).not.toHaveProperty('failures')
    const bad = fullRow({ kind: 'video_generation', result: { assetId: 5 } })
    expect(agentJobView(bad, PROVIDERS).assetIds).toEqual([])
  })

  it('gives [] and no failures for any other job kind', () => {
    const other = fullRow({ kind: 'export', result: { assetIds: ['x'], assetId: 'y' } })
    const view = agentJobView(other, PROVIDERS)
    expect(view.assetIds).toEqual([])
    expect(view).not.toHaveProperty('failures')
  })

  it('gives failures as error kind to whole count, dropping anything else', () => {
    const result = { failures: { offline: 2, quota: 1.5, made_up: 3, timeout: '1', other: 1 } }
    expect(agentJobView(fullRow({ result }), []).failures).toEqual({ offline: 2, other: 1 })
    expect(agentJobView(fullRow({ result: {} }), []).failures).toEqual({})
  })
})

describe('agentJobView message [MCP-D] (security class)', () => {
  it('fills {address} with "the saved ComfyUI address"', () => {
    const view = agentJobView(fullRow({ status: 'failed', errorReason: 'no_answer' }), PROVIDERS)
    expect(view.message).toBe(
      'Nothing answered at the saved ComfyUI address. Check that ComfyUI is running and the address is right.',
    )
  })

  it('fills {n} with "some"', () => {
    const row = fullRow({ status: 'failed', errorReason: 'missing_items' })
    expect(agentJobView(row, PROVIDERS).message).toBe(
      'The server is missing some thing(s) this workflow needs. Add them to the server yourself, then try again.',
    )
  })

  it("gives the kind's sentence with the provider label when there is no reason", () => {
    const row = fullRow({ provider: 'gemini', errorKind: 'quota', errorReason: null })
    expect(agentJobView(row, PROVIDERS).message).toBe(plainMessage('quota', 'Google Gemini'))
  })

  it('names no provider ID when the provider is not in the list', () => {
    const row = fullRow({ provider: 'made-up-provider', errorKind: 'bad_key', errorReason: null })
    const message = agentJobView(row, PROVIDERS).message
    expect(message).toBe(plainMessage('bad_key', 'The provider'))
    expect(message).not.toContain('made-up-provider')
  })

  it('gives null when there is neither a reason nor a kind', () => {
    const row = fullRow({ errorKind: null, errorReason: null })
    expect(agentJobView(row, PROVIDERS).message).toBeNull()
  })

  it('fills {provider} of a local reason with the registry label [P4-5, OI-68]', () => {
    const row = fullRow({ provider: 'gemini', errorKind: 'other', errorReason: 'key_missing' })
    expect(agentJobView(row, PROVIDERS).message).toBe(
      'Your Google Gemini key was removed after this run was queued. Add it in Settings, then try again.',
    )
  })
})

// P10-5 (A-232): what get_job shows of the three AI runs. Each result carries planted keys
// that must not leave: the request, the prompt sent, the model and the server's words.
const PLANTED = {
  prompt: 'made-up prompt sent',
  model: 'made-up-model',
  serverText: 'made-up server words',
  request: { prompt: 'made-up request' },
}
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

describe('agentJobView for the AI runs [P10-5, A-232] (security class)', () => {
  const run = (kind: JobRow['kind'], result: unknown, status: JobRow['status'] = 'succeeded') =>
    agentJobView(fullRow({ kind, status, result, errorKind: null, errorReason: null }), PROVIDERS)

  it('gives a cutout job its asset IDs as strings only, and nothing else of result', () => {
    const view = run('cutout', { assetIds: ['a-cut', 3, null], ...PLANTED })
    expect(view.assetIds).toEqual(['a-cut'])
    expect(Object.keys(view).sort()).toEqual(
      SHOWN.filter((k) => k !== 'failures' && k !== 'stage' && k !== 'queuePosition').sort(),
    )
    expect(JSON.stringify(view)).not.toContain('made-up')
  })

  it('gives a succeeded layout job its boxes, each with the eight named fields only', () => {
    const extra = { ...BOX, prompt: 'made-up box prompt', path: '/Users/someone/x.png' }
    const view = run('layout_proposal', { boxes: [extra, BOX], ...PLANTED })
    expect(view.layout).toEqual({ boxes: [BOX, BOX] })
    expect(view.assetIds).toEqual([])
    expect(view).not.toHaveProperty('copyOptions')
    const text = JSON.stringify(view)
    for (const word of ['made-up', '/Users/someone', '"prompt"', '"model"', '"request"']) {
      expect(text, word).not.toContain(word)
    }
  })

  it('drops a box with a field of the wrong type, and boxes that are not a list', () => {
    const bad = [{ ...BOX, x: '10' }, { ...BOX, color: 7 }, { ...BOX, align: null }, 'box', null]
    expect(run('layout_proposal', { boxes: [...bad, BOX] }).layout).toEqual({ boxes: [BOX] })
    expect(run('layout_proposal', { boxes: 'all' }).layout).toEqual({ boxes: [] })
    expect(run('layout_proposal', null).layout).toEqual({ boxes: [] })
  })

  it.each(['failed', 'running', 'queued', 'cancelled'] as const)(
    'gives a %s layout job no layout',
    (status) => {
      expect(run('layout_proposal', { boxes: [BOX] }, status)).not.toHaveProperty('layout')
    },
  )

  it('gives a succeeded copy_options job its option texts as strings only', () => {
    const view = run('copy_options', { options: ['Shop now', 4, { text: 'x' }, 'Go'], ...PLANTED })
    expect(view.copyOptions).toEqual(['Shop now', 'Go'])
    expect(view.assetIds).toEqual([])
    expect(view).not.toHaveProperty('layout')
    expect(JSON.stringify(view)).not.toContain('made-up')
    expect(run('copy_options', { options: 'Shop now' }).copyOptions).toEqual([])
  })

  it('gives an unfinished or failed copy_options job no options', () => {
    expect(run('copy_options', { options: ['A'] }, 'failed')).not.toHaveProperty('copyOptions')
    expect(run('copy_options', { options: ['A'] }, 'running')).not.toHaveProperty('copyOptions')
  })

  it('gives no layout or copyOptions to any other kind with the same result keys', () => {
    const view = run('image_generation', { boxes: [BOX], options: ['A'], assetIds: [] })
    expect(view).not.toHaveProperty('layout')
    expect(view).not.toHaveProperty('copyOptions')
  })
})
