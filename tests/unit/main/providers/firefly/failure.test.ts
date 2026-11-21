import { describe, it, expect } from 'vitest'
import { failureFromAnswer } from '@/main/providers/firefly/failure'
import { TEST_CLIENT_SECRET } from './recorded'

describe('Firefly answer failure [P4-6, spec/providers.md "Failures"]', () => {
  it('removes a secret that crosses the cut point, in whole and in part', () => {
    const prefix = 'x'.repeat(500 - 10)
    const text = `${prefix}${TEST_CLIENT_SECRET} trailing words`
    const failure = failureFromAnswer(500, text, [TEST_CLIENT_SECRET])
    const detail = failure.error.detail
    expect(detail).not.toContain(TEST_CLIENT_SECRET)
    expect(detail).not.toContain(TEST_CLIENT_SECRET.slice(0, 10))
  })
})
