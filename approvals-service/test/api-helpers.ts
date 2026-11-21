// Shared by the link API tests: an app with a known key, requests, and table counts.
import { db } from './db'
import { createApp, type Parts } from '../src/app'
import { cryptoBytes } from '../src/crypto/random'
import { addSignoff } from '../src/db/signoffs'

export const KEY = 'k'.repeat(40)
export const NOW = 1_700_000_000_000
export const ORIGIN = 'https://approvals.example'
export const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
export { db }

export const parts: Parts = { now: () => NOW, random: cryptoBytes }

export function app(over: Partial<Parts> = {}, testOrigin?: string) {
  const appEnv = { DB: db, API_KEY: KEY, TEST_PICTURE_ORIGIN: testOrigin }
  return createApp(appEnv, { ...parts, ...over })
}

export function call(method: string, path: string, body?: unknown): Request {
  const headers: Record<string, string> = { Authorization: `Bearer ${KEY}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new Request(`${ORIGIN}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const linkPath = (campaignId: string) => `/links/${PROJECT}/${campaignId}`

export function picture(name: string) {
  return `https://my-bucket.s3.eu-west-1.amazonaws.com/${name}.png?X-Amz-Signature=secret`
}

export async function countFor(table: string, linkId: string): Promise<number> {
  const column = table === 'link' ? 'id' : 'link_id'
  const sql = `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`
  return (await db.prepare(sql).bind(linkId).first<number>('n')) ?? 0
}

export async function linkIdOf(campaignId: string): Promise<string> {
  const sql = 'SELECT id FROM link WHERE project_id = ? AND campaign_id = ?'
  const id = await db.prepare(sql).bind(PROJECT, campaignId).first<string>('id')
  if (id === null) throw new Error('no link')
  return id
}

export const PASSWORD = 'correct horse battery'

export async function create(campaignId: string, over: Partial<Parts> = {}) {
  const body = { projectId: PROJECT, campaignId, campaignName: 'Spring', password: PASSWORD }
  return app(over).fetch(call('POST', '/links', body))
}

export function variant(variantKey: string, version = 1) {
  return {
    variantKey,
    title: `Title ${variantKey}`,
    sizeLine: '1080 × 1080',
    version,
    pictureUrl: picture(variantKey),
    pictureExpiresAt: '2026-12-01T00:00:00.000Z',
  }
}

export const putGallery = (campaignId: string, variants: unknown[], campaignName = 'Spring') =>
  app().fetch(call('PUT', `${linkPath(campaignId)}/gallery`, { campaignName, variants }))

export async function signoff(linkId: string, n: number, variantKey: string, version: number) {
  const row = { id: `s${n}`.padEnd(24, 'x'), variantKey, version, email: `p${n}@a.co` }
  await addSignoff(db, linkId, { ...row, createdAt: NOW + n }).run()
}

export const errorCode = async (reply: Response) =>
  ((await reply.json()) as { error: { code: string } }).error.code

export async function clearAll() {
  await db.batch(
    ['session', 'signoff', 'gallery_variant', 'link'].map((t) => db.prepare(`DELETE FROM ${t}`)),
  )
}
