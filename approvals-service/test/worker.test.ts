import { describe, it, expect } from 'vitest'
import { env, exports } from 'cloudflare:workers'

// One request through the Worker's own entry proves index.ts wires the same app.
describe('the Worker entry', () => {
  it('answers health with the key from its environment', async () => {
    const reply = await exports.default.fetch('https://approvals.example/api/v1/health', {
      headers: { Authorization: `Bearer ${env.API_KEY}` },
    })
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ service: 'adman-approvals', contract: 1 })
  })

  it('answers robots.txt and a slug of the right shape with their pages', async () => {
    const robots = await exports.default.fetch('https://approvals.example/robots.txt')
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
    const page = await exports.default.fetch('https://approvals.example/l/aZ09aZ09aZ09')
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<h1>Review campaign</h1>')
  })

  it.each(['/nothing', '/l/short'])('answers %s with the plain 404 page', async (path) => {
    const reply = await exports.default.fetch(`https://approvals.example${path}`)
    expect(reply.status).toBe(404)
    expect(reply.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await reply.text()).toBe('Not found.')
  })
})
