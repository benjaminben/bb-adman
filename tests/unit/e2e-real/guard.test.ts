import { describe, it, expect } from 'vitest'
import { guardedStep, HIDDEN_FAILURE } from '../../e2e-real/guard'

const SECRET = 'http://192.0.2.10:8188/secret-photo.jpg'

describe('a guarded step prints its name only [SPEC 14 1.56 E2E-R, the address]', () => {
  it('gives back what the step gives back', async () => {
    expect(await guardedStep('Read a number', async () => 7)).toBe(7)
  })

  it('rethrows one fixed sentence with the step name, and no cause', async () => {
    const error = await guardedStep('Save the server address', async () => {
      throw new Error(`could not reach ${SECRET}`, { cause: new Error(SECRET) })
    }).catch((e: unknown) => e as Error)
    expect(error.message).toBe(`Save the server address: ${HIDDEN_FAILURE}`)
    expect(error.cause).toBeUndefined()
    expect(error.stack ?? '').not.toContain(SECRET)
    expect(JSON.stringify(Object.entries(error))).not.toContain(SECRET)
  })

  it('hides a thrown value that is not an error the same way', async () => {
    const error = await guardedStep('Check', async () => {
      throw SECRET
    }).catch((e: unknown) => e as Error)
    expect(error.message).toBe(`Check: ${HIDDEN_FAILURE}`)
  })
})
