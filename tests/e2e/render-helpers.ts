// Shared steps for the render window and asset font end-to-end tests (P3-6).
import { expect, type Page } from '@playwright/test'
import path from 'node:path'

// A real font file to import: the bundled Inter, so no font fixture is needed.
export const FONT_FILE = path.resolve('src/shared/scene/fonts/InterVariable.woff2')

type Reply = { ok: boolean; data: Record<string, unknown>; error?: unknown }
type Api = { [k in 'command' | 'query']: (n: string, i: unknown) => Promise<unknown> }

async function call(page: Page, kind: 'command' | 'query', name: string, input: unknown) {
  const reply = (await page.evaluate(
    ([k, n, i]) => (window as unknown as { api: Api }).api[k](n, i),
    [kind, name, input] as const,
  )) as Reply
  expect(reply.ok, JSON.stringify(reply.error)).toBe(true)
  return reply.data
}

export const command = (page: Page, name: string, input: unknown) =>
  call(page, 'command', name, input)
export const query = (page: Page, name: string, input: unknown) => call(page, 'query', name, input)
