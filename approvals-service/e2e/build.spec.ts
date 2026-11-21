import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// spec/approvals-gallery.md "Nothing about a link is built ahead or cached": the build the web
// server made lists no prerendered route under /l.
type Manifest = { routes: Record<string, unknown>; dynamicRoutes: Record<string, unknown> }

test('the build prerenders no route under /l', () => {
  const path = new URL('../.next/prerender-manifest.json', import.meta.url)
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest
  const listed = [...Object.keys(manifest.routes), ...Object.keys(manifest.dynamicRoutes)]
  expect(listed.filter((route) => route === '/l' || route.startsWith('/l/'))).toEqual([])
})
