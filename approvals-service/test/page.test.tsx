import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { putVariant } from '../src/db/variants'
import type { Db } from '../src/db/client'
import { GalleryScreen } from '../src/ui/gallery-screen/gallery-screen'
import { PasswordScreen } from '../src/ui/password-screen/password-screen'
import { openGallery } from '../src/visitor/actions'
import { addLink, clearTables, db, enter, makeApp } from './visitor-setup'

// spec/approvals-gallery.md "Routes", "Rules the page keeps": the page reads only the path's
// slug, the Cookie header and `m`, and hands only the view on. Next.js's request helpers are
// stood in for; the database is the test one.
const state = vi.hoisted(() => ({ cookie: null as string | null, db: null as Db | null }))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(state.cookie === null ? {} : { cookie: state.cookie }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(),
}))
vi.mock('../src/server/env', () => ({ loadEnv: () => ({ DB: state.db }), isDev: () => false }))

const { default: GalleryPage } = await import('../app/l/[slug]/page')
const navigation = await import('next/navigation')

type Query = Record<string, string | string[] | undefined>

function open(slug: string, query: Query = {}, cookie: string | null = null) {
  state.cookie = cookie
  return GalleryPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) })
}

const NOW = Date.now()

async function setup() {
  const app = makeApp(() => NOW)
  const link = await addLink(1, 'Secret Campaign')
  await putVariant(db, link.id, {
    variantKey: 'aaaa22',
    position: 0,
    title: 'T',
    sizeLine: 'S',
    version: 1,
    pictureUrl: 'https://h.example/p.png',
    pictureExpiresAt: NOW + 60_000,
  }).run()
  return { link, cookie: await enter(app, link.slug) }
}

describe('GET /l/{slug} [approvals-gallery.md "Routes"]', () => {
  beforeEach(async () => {
    await clearTables()
    state.db = db
    vi.mocked(navigation.notFound).mockClear()
    vi.mocked(navigation.redirect).mockClear()
  })

  type Row = [string, (slug: string, cookie: string) => [string, Query, string | null], unknown]
  const ROWS: Row[] = [
    ['an unknown slug', () => ['zzzzzzzzzzzz', {}, null], null],
    ['a real slug without a session', (slug) => [slug, {}, null], null],
    ['an unknown slug with a cookie', (_s, c) => ['zzzzzzzzzzzz', {}, c], null],
    ['a wrong password notice', (slug) => [slug, { m: 'wrong-password' }, null], 'wrong-password'],
    ['m given twice', (slug) => [slug, { m: ['wrong-password', 'x'] }, null], null],
    ['a gallery notice on the password page', (slug) => [slug, { m: 'signed' }, null], null],
  ]

  it.each(ROWS)('draws the password screen for %s', async (_name, make, notice) => {
    const { link, cookie } = await setup()
    const [slug, query, sent] = make(link.slug, cookie)
    const element = (await open(slug, query, sent)) as ReactElement
    expect(element.type).toBe(PasswordScreen)
    expect(element.props).toEqual({ slug, notice })
    expect(navigation.notFound).not.toHaveBeenCalled()
    expect(navigation.redirect).not.toHaveBeenCalled()
  })

  it('draws the gallery screen with the view as its only prop', async () => {
    const { link, cookie } = await setup()
    const element = (await open(link.slug, { m: 'signed' }, cookie)) as ReactElement
    const expected = await openGallery(db, { slug: link.slug, cookie, m: 'signed' }, NOW)
    if (expected.kind !== 'gallery') throw new Error('no gallery')
    expect(element.type).toBe(GalleryScreen)
    expect(element.props).toEqual({ view: expected.view })
    expect(navigation.redirect).not.toHaveBeenCalled()
  })

  it.each(['short', 'aaaaaaaaaaa-', 'aaaaaaaaaaaaa', '%41aaaaaaaaaa'])(
    'calls notFound for the wrong-shape slug %j',
    async (slug) => {
      await expect(open(slug)).rejects.toThrow('NEXT_NOT_FOUND')
      expect(navigation.notFound).toHaveBeenCalledOnce()
    },
  )

  it('logs only the error name and throws the fixed PageFailed on a failure', async () => {
    const broken = Object.assign(new Error('secret zzqq'), { name: 'DbBroke' })
    state.db = {
      prepare() {
        throw broken
      },
      async batch() {
        throw broken
      },
    }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = await open('zzzzzzzzzzzz').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).name).toBe('PageFailed')
    expect((failure as Error).message).not.toContain('zzqq')
    expect(log.mock.calls).toEqual([['gallery-page', 'DbBroke']])
    log.mockRestore()
  })
})
