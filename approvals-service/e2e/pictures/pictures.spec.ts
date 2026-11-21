import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext } from '@playwright/test'

// spec/approvals-service-visitor.md "Pictures" and "Forms that write" (AP-4), through `next start`:
// a link seeded through the keyed API, as the app would, with its pictures on the test picture
// server. Every address is http://localhost:{port}; the form Origin check is not loosened.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const CAMPAIGN = 'pictures-k7m2pq'
const PASSWORD = 'pictures password 1'

const VARIANTS = [
  { variantKey: 'aaaa22', file: 'a.png', type: 'image/png' },
  { variantKey: 'bbbb33', file: 'b.png', type: 'image/png' },
  { variantKey: 'cccc44', file: 'c.jpg', type: 'image/jpeg' },
]

async function seed(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/v1/links', {
    headers: auth,
    data: {
      projectId: PROJECT,
      campaignId: CAMPAIGN,
      campaignName: 'Pictures',
      password: PASSWORD,
    },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const gallery = await request.put(`/api/v1/links/${PROJECT}/${CAMPAIGN}/gallery`, {
    headers: auth,
    data: {
      campaignName: 'Pictures',
      variants: VARIANTS.map(({ variantKey, file }) => ({
        variantKey,
        title: file,
        sizeLine: '64 × 64',
        version: 1,
        pictureUrl: `${PICTURES}/${file}`,
        pictureExpiresAt: expires,
      })),
    },
  })
  expect(gallery.status()).toBe(200)
  return slug
}

async function enter(request: APIRequestContext, slug: string): Promise<string> {
  const reply = await request.post(`/l/${slug}/enter`, {
    headers: { Origin: ORIGIN },
    form: { password: PASSWORD },
    maxRedirects: 0,
  })
  expect(reply.status()).toBe(303)
  expect(reply.headers().location).toBe(`/l/${slug}`)
  return (reply.headers()['set-cookie'] ?? '').split(';')[0] ?? ''
}

test('pictures pass only for a session, typed by the sniff; a sign-off goes back to its variant', async ({
  request,
  playwright,
}) => {
  const slug = await seed(request)
  const cookie = await enter(request, slug)
  // The fixture's context keeps the cookie from /enter, so "no session" needs a context of its own.
  const stranger = await playwright.request.newContext({ baseURL: ORIGIN })
  for (const { variantKey, file, type } of VARIANTS) {
    const path = `/l/${slug}/p/${variantKey}/1`
    const reply = await request.get(path, { headers: { Cookie: cookie } })
    expect(reply.status()).toBe(200)
    expect(reply.headers()['content-type']).toBe(type)
    expect(reply.headers()['cache-control']).toBe('no-store')
    expect(reply.headers()['content-security-policy']).toBe("default-src 'none'; sandbox")
    expect(Buffer.from(await reply.body())).toEqual(readFileSync(new URL(file, import.meta.url)))
    const without = await stranger.get(path)
    expect(without.status()).toBe(404)
    expect((await without.body()).byteLength).toBe(0)
    expect(await without.text()).not.toContain('127.0.0.1')
  }
  await stranger.dispose()
  const wrongVersion = await request.get(`/l/${slug}/p/aaaa22/2`, { headers: { Cookie: cookie } })
  expect(wrongVersion.status()).toBe(404)

  // A sign-off goes back to its variant.
  const signed = await request.post(`/l/${slug}/signoffs`, {
    headers: { Origin: ORIGIN, Cookie: cookie },
    form: { variant: 'bbbb33', version: '1', email: 'Ann@Example.com' },
    maxRedirects: 0,
  })
  expect(signed.status()).toBe(303)
  expect(signed.headers().location).toBe(`/l/${slug}?m=signed#v-bbbb33`)
})
