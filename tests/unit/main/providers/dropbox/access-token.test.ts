import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import {
  standInFetch,
  startDropboxStandIn,
  type DropboxStandIn,
} from '../../../../helpers/dropbox-stand-in'
import { accessTokenFor, forgetDropboxAccess } from '@/main/providers/dropbox/access-token'

const MINUTE = 60_000
let standIn: DropboxStandIn
let dropboxFetch: typeof fetch
let clock = 0
const now = () => clock
const logs: unknown[][] = []
const renewals = () => standIn.seen.filter((s) => s.route === 'token').length

beforeAll(async () => {
  standIn = await startDropboxStandIn()
  dropboxFetch = standInFetch(standIn)
})
afterAll(() => standIn.close())
beforeEach(() => {
  forgetDropboxAccess()
  standIn.seen.length = 0
  standIn.expiresIn = 4 * 60 * 60
  clock = 1_000_000
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args))
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  expect(logs).toEqual([])
})

describe('the access token in memory [P9-2, phase-09 "Dropbox tokens"]', () => {
  it('is reused until 5 minutes before it ends, then renewed', async () => {
    const refresh = standIn.plantRefreshToken()
    const first = await accessTokenFor(refresh, dropboxFetch, now)
    expect(standIn.refreshFor(first)).toBe(refresh)
    clock += 4 * 60 * MINUTE - 5 * MINUTE - 1
    expect(await accessTokenFor(refresh, dropboxFetch, now)).toBe(first)
    expect(renewals()).toBe(1)
    clock += 1
    const second = await accessTokenFor(refresh, dropboxFetch, now)
    expect(second).not.toBe(first)
    expect(standIn.refreshFor(second)).toBe(refresh)
    expect(renewals()).toBe(2)
  })

  it('keeps two refresh tokens apart', async () => {
    const one = standIn.plantRefreshToken()
    const two = standIn.plantRefreshToken()
    const forOne = await accessTokenFor(one, dropboxFetch, now)
    const forTwo = await accessTokenFor(two, dropboxFetch, now)
    expect(standIn.refreshFor(forOne)).toBe(one)
    expect(standIn.refreshFor(forTwo)).toBe(two)
    expect(await accessTokenFor(one, dropboxFetch, now)).toBe(forOne)
    expect(await accessTokenFor(two, dropboxFetch, now)).toBe(forTwo)
    expect(renewals()).toBe(2)
  })

  it('asks Dropbox once for two calls at the same time', async () => {
    const refresh = standIn.plantRefreshToken()
    const [a, b] = await Promise.all([
      accessTokenFor(refresh, dropboxFetch, now),
      accessTokenFor(refresh, dropboxFetch, now),
    ])
    expect(a).toBe(b)
    expect(renewals()).toBe(1)
  })

  it('is forgotten for one refresh token, or for all', async () => {
    const one = standIn.plantRefreshToken()
    const two = standIn.plantRefreshToken()
    const forOne = await accessTokenFor(one, dropboxFetch, now)
    const forTwo = await accessTokenFor(two, dropboxFetch, now)
    forgetDropboxAccess(one)
    expect(await accessTokenFor(one, dropboxFetch, now)).not.toBe(forOne)
    expect(await accessTokenFor(two, dropboxFetch, now)).toBe(forTwo)
    forgetDropboxAccess()
    expect(await accessTokenFor(two, dropboxFetch, now)).not.toBe(forTwo)
    expect(renewals()).toBe(4)
  })

  it('a renewal that ends after it was forgotten is not kept', async () => {
    const refresh = standIn.plantRefreshToken()
    standIn.once('token', { slowMs: 100 })
    const late = accessTokenFor(refresh, dropboxFetch, now)
    await new Promise((resolve) => setTimeout(resolve, 20))
    forgetDropboxAccess(refresh)
    const lateToken = await late
    expect(await accessTokenFor(refresh, dropboxFetch, now)).not.toBe(lateToken)
    expect(renewals()).toBe(2)
  })

  it('a revoked refresh token ends signed out and leaves the other token held', async () => {
    const kept = standIn.plantRefreshToken()
    const keptAccess = await accessTokenFor(kept, dropboxFetch, now)
    const gone = standIn.plantRefreshToken()
    const goneAccess = await accessTokenFor(gone, dropboxFetch, now)
    standIn.once('token', { oauthError: 'invalid_grant' })
    forgetDropboxAccess(gone)
    const error = await accessTokenFor(gone, dropboxFetch, now).catch((e: unknown) => e)
    const failure = await failureOf(Promise.reject(error))
    expect(failure).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: '400 invalid_grant',
    })
    const text = `${String(error)} ${(error as Error).stack ?? ''} ${JSON.stringify(failure)}`
    for (const token of [gone, goneAccess]) expect(text).not.toContain(token)
    expect(await accessTokenFor(kept, dropboxFetch, now)).toBe(keptAccess)
    const next = await accessTokenFor(gone, dropboxFetch, now)
    expect(standIn.refreshFor(next)).toBe(gone)
  })
})
