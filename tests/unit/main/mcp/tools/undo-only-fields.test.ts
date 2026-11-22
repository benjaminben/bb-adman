// P7-10b: no agent tool publishes or passes an undo-only field (undoClipId and redoClipId of
// variant.setFormat, durationOverridden of variant.update), at the top level or nested.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { MCP_TOOLS } from '@/main/mcp/tools'

const BANNED = [
  'undoClipId',
  'undo_clip_id',
  'redoClipId',
  'redo_clip_id',
  'durationOverridden',
  'duration_overridden',
]

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

// Every property name anywhere in a JSON schema.
function propertyNames(node: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(node)) for (const n of node) propertyNames(n, into)
  else if (node && typeof node === 'object') {
    const props = (node as { properties?: object }).properties
    if (props && typeof props === 'object') for (const k of Object.keys(props)) into.add(k)
    for (const v of Object.values(node)) propertyNames(v, into)
  }
  return into
}

describe('agent tools and the undo-only fields [P7-10b]', () => {
  it.each(MCP_TOOLS.map((t) => [t.name, t] as const))('%s publishes none of them', (_, t) => {
    const top = Object.keys(t.input.shape).flatMap((k) => [k, snake(k)])
    const json = z.toJSONSchema(t.input, { io: 'input', unrepresentable: 'any' })
    const names = [...top, ...propertyNames(json, new Set())]
    expect(names.filter((n) => BANNED.includes(n))).toEqual([])
  })
})
