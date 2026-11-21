import { describe, it, expect } from 'vitest'
import wranglerText from '../wrangler.jsonc?raw'

// Drops // and /* */ comments and trailing commas, leaving text inside strings alone.
function parseJsonc(text: string): unknown {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j + 1
    } else if (text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') i++
    } else if (text.startsWith('/*', i)) {
      i = text.indexOf('*/', i + 2) + 2
    } else {
      out += ch
      i++
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

type Wrangler = {
  send_metrics?: boolean
  vars?: Record<string, unknown>
  d1_databases?: Array<Record<string, unknown>>
}

const config = parseJsonc(wranglerText) as Wrangler

describe('wrangler.jsonc [approvals-service.md "Folder and tooling"]', () => {
  it('switches off usage data', () => {
    expect(config.send_metrics).toBe(false)
  })

  it('holds neither the key nor the test picture origin as a plain value', () => {
    const names = Object.keys(config.vars ?? {})
    expect(names).not.toContain('API_KEY')
    expect(names).not.toContain('TEST_PICTURE_ORIGIN')
  })

  it('binds DB with the all-zero placeholder database ID', () => {
    expect(config.d1_databases).toEqual([
      {
        binding: 'DB',
        database_name: 'adman-approvals',
        database_id: '00000000-0000-0000-0000-000000000000',
        migrations_dir: 'migrations',
      },
    ])
  })
})
