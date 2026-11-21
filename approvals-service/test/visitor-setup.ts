// Shared set-up for the visitor tests: a link with a real password hash, a movable clock and
// form requests that pass the form checks unless a test changes them.
import { env } from 'cloudflare:workers'
import { createApp } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { hashPassword, type StoredPassword } from '../src/crypto/password'
import * as links from '../src/db/links'

export const ORIGIN = 'https://approvals.example'
export const PASSWORD = 'correct horse battery'
export const db = env.DB

export function clock(start = Date.UTC(2026, 10, 21, 12, 0)) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

export function makeApp(now: () => number) {
  return createApp({ DB: env.DB }, { now, random: cryptoBytes })
}

// One real hash at the full iteration count, made once per test file.
let stored: Promise<StoredPassword> | null = null

export async function addLink(n: number, campaignName = `Campaign ${n}`) {
  stored ??= hashPassword(PASSWORD)
  const link: links.LinkRow = {
    id: `link${n}`.padEnd(24, 'x'),
    slug: `slug${n}`.padEnd(12, 'x'),
    projectId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    campaignId: `campaign-${n}-abc234`,
    campaignName,
    password: await stored,
    createdAt: 1000 + n,
  }
  await links.insertLink(db, link).run()
  return link
}

export async function clearTables() {
  await db.batch(
    ['session', 'signoff', 'gallery_variant', 'link'].map((t) => db.prepare(`DELETE FROM ${t}`)),
  )
}

export type FormOptions = { cookie?: string; headers?: Record<string, string>; body?: string }

export function form(path: string, fields: Record<string, string>, options: FormOptions = {}) {
  const headers: Record<string, string> = {
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(options.cookie === undefined ? {} : { Cookie: options.cookie }),
    ...options.headers,
  }
  const body = options.body ?? new URLSearchParams(fields).toString()
  return new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body })
}

export function get(path: string, cookie?: string) {
  return new Request(
    `${ORIGIN}${path}`,
    cookie === undefined ? {} : { headers: { Cookie: cookie } },
  )
}

// The `name=value` part of the reply's Set-Cookie.
export function cookieOf(reply: Response): string {
  return (reply.headers.get('Set-Cookie') ?? '').split(';')[0] ?? ''
}

// Signs in to the link and gives the cookie to send back.
export async function enter(app: ReturnType<typeof makeApp>, slug: string) {
  const reply = await app.fetch(form(`/l/${slug}/enter`, { password: PASSWORD }))
  if (reply.status !== 303) throw new Error(`enter answered ${reply.status}`)
  return cookieOf(reply)
}

export async function bytesOf(reply: Response) {
  return {
    status: reply.status,
    headers: [...reply.headers],
    body: new Uint8Array(await reply.arrayBuffer()),
  }
}
