// CW-7: a missing_items failure of a custom workflow holds no node type name (spec/
// comfyui-custom.md "The check and what is missing", "Security" rule 2). A shipped one keeps
// its list.
import { describe, it, expect } from 'vitest'
import { missingFailure } from '@/main/providers/comfyui/failures'
import { checked } from '@/main/providers/comfyui/session'
import type { ComfyClient } from '@/main/providers/comfyui/client'
import type { ServerChecks } from '@/main/providers/comfyui/needs'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { MissingItem } from '@/shared/schemas/queries/app'
import { ProviderFailure } from '@/main/providers/types'

const ITEMS: MissingItem[] = [
  { what: 'node', name: 'LensFlarePro' },
  { what: 'node', name: 'GrainKit' },
]

const custom: WorkflowSpec = { ...mossTextToImage, id: 'custom-0123456789ab', status: 'custom' }

const client = {} as ComfyClient

function checksAnswering(...answers: ComfyCheck[]) {
  const calls: Array<{ fresh: boolean }> = []
  const checks: ServerChecks = {
    async run(_origin, _client, _workflows, run = {}) {
      calls.push({ fresh: run.fresh === true })
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
      if (!answer) throw new Error('no answer')
      return answer
    },
  }
  return { checks, calls }
}

const okWith = (workflows: ComfyCheck['workflows']): ComfyCheck => ({
  outcome: 'ok',
  version: '0.45.0',
  workflows,
})

async function failureOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (e) {
    if (e instanceof ProviderFailure) return e.error
    throw e
  }
  throw new Error('did not fail')
}

describe('missingFailure for a custom workflow [CW-7, rule 2]', () => {
  it('stores an empty list and the count, and no name in the detail', () => {
    const error = missingFailure(ITEMS, true).error
    expect(error).toMatchObject({ kind: 'other', reason: 'missing_items', missing: [] })
    expect(error.missingCount).toBe(2)
    expect(JSON.stringify(error)).not.toContain('LensFlarePro')
    expect(JSON.stringify(error)).not.toContain('GrainKit')
  })

  it('keeps the list and sets no count for a shipped workflow, as before', () => {
    const error = missingFailure(ITEMS).error
    expect(error.missing).toEqual(ITEMS)
    expect(error).not.toHaveProperty('missingCount')
  })
})

describe('checked: the run check of a custom workflow [CW-7]', () => {
  it('fails missing_items with no names when the custom workflow lacks a node type', async () => {
    const { checks } = checksAnswering(okWith([{ id: custom.id, missing: ITEMS }]))
    const error = await failureOf(checked(checks, 'http://x', client, custom, [custom]))
    expect(error).toMatchObject({ reason: 'missing_items', missing: [], missingCount: 2 })
  })

  it('keeps the names for a shipped workflow', async () => {
    const { checks } = checksAnswering(okWith([{ id: mossTextToImage.id, missing: ITEMS }]))
    const error = await failureOf(
      checked(checks, 'http://x', client, mossTextToImage, [mossTextToImage]),
    )
    expect(error).toMatchObject({ reason: 'missing_items', missing: ITEMS })
    expect(error).not.toHaveProperty('missingCount')
  })

  it('asks again, fresh, when a kept result does not hold the run workflow', async () => {
    const { checks, calls } = checksAnswering(
      okWith([{ id: mossTextToImage.id, missing: [] }]),
      okWith([{ id: custom.id, missing: [] }]),
    )
    await expect(checked(checks, 'http://x', client, custom, [custom])).resolves.toBe('0.45.0')
    expect(calls).toEqual([{ fresh: false }, { fresh: true }])
  })
})
