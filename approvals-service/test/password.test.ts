import { describe, it, expect } from 'vitest'
import { PASSWORD_ITERATIONS, checkPassword, hashPassword } from '../src/crypto/password'
import { sameSecret } from '../src/crypto/compare'

const PASSWORD = 'correct horse battery'

describe('password hash [approvals-service.md "Random values and passwords"]', () => {
  it('uses PBKDF2 at 100,000 iterations', async () => {
    expect(PASSWORD_ITERATIONS).toBe(100_000)
    const stored = await hashPassword(PASSWORD)
    expect(stored.iterations).toBe(100_000)
    expect(atob(stored.hash)).toHaveLength(32)
    expect(atob(stored.salt)).toHaveLength(16)
    expect(await checkPassword(PASSWORD, stored)).toBe(true)
  })

  it('refuses a wrong password', async () => {
    const stored = await hashPassword(PASSWORD, 1000)
    expect(await checkPassword('correct horse battery!', stored)).toBe(false)
    expect(await checkPassword('', stored)).toBe(false)
  })

  it('uses the iteration count stored with the link', async () => {
    const stored = await hashPassword(PASSWORD, 1000)
    expect(await checkPassword(PASSWORD, stored)).toBe(true)
    expect(await checkPassword(PASSWORD, { ...stored, iterations: 1001 })).toBe(false)
  })

  it('gives a new salt, and so a new hash, to each password', async () => {
    const a = await hashPassword(PASSWORD, 1000)
    const b = await hashPassword(PASSWORD, 1000)
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('runs the hash once against a dummy salt when there is no link, and refuses', async () => {
    expect(await checkPassword(PASSWORD, null)).toBe(false)
  })
})

describe('sameSecret', () => {
  it.each([
    ['same', 'k'.repeat(40), 'k'.repeat(40), true],
    ['one letter off', 'k'.repeat(40), `${'k'.repeat(39)}j`, false],
    ['shorter', 'k'.repeat(40), 'k'.repeat(39), false],
    ['empty', 'k'.repeat(40), '', false],
  ])('%s', async (_name, a, b, expected) => {
    expect(await sameSecret(a, b)).toBe(expected)
  })
})
