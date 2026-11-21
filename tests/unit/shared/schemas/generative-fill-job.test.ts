// P5-1 (spec/links-and-sync.md "Generative fill"): the generative_fill job's request and result.
import { describe, it, expect } from 'vitest'
import {
  generativeFillJobRequest,
  generativeFillJobResult,
} from '@/shared/schemas/jobs/generative-fill'

const JOB_REQUEST = {
  prompt: 'Extend this picture.',
  sourceAssetId: 'A1',
  placement: { x: 10, y: 20, width: 500, height: 400 },
  width: 1080,
  height: 1920,
}

describe('the generative_fill job shapes [P5-1, spec/links-and-sync.md "Generative fill"]', () => {
  it('reads a request and a result', () => {
    expect(generativeFillJobRequest.parse(JOB_REQUEST)).toEqual(JOB_REQUEST)
    expect(generativeFillJobResult.parse({ assetIds: ['A2'] })).toEqual({ assetIds: ['A2'] })
  })

  it.each<[string, Record<string, unknown>]>([
    ['no prompt', { ...JOB_REQUEST, prompt: '' }],
    ['no source', { ...JOB_REQUEST, sourceAssetId: '' }],
    ['a placement of no width', { ...JOB_REQUEST, placement: { x: 0, y: 0, width: 0, height: 1 } }],
    ['a canvas of no height', { ...JOB_REQUEST, height: 0 }],
  ])('refuses a request with %s', (_label, value) => {
    expect(generativeFillJobRequest.safeParse(value).success).toBe(false)
  })
})
