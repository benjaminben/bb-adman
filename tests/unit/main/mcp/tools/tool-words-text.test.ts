// Review leftovers, tool words: get_job names the two run results it can give (layout and
// copyOptions), and the provider words do not call Gemini "pictures only", since it also
// writes text (briefs, copy and translation).
import { describe, expect, it } from 'vitest'
import { MCP_TOOLS } from '@/main/mcp/tools'
import { PROVIDER_WORDS } from '@/main/mcp/tools/tool-words'

describe('the tool words', () => {
  it('get_job names layout and copyOptions', () => {
    const getJob = MCP_TOOLS.find((t) => t.name === 'get_job')
    expect(getJob?.description).toContain('layout')
    expect(getJob?.description).toContain('copyOptions')
  })

  it('PROVIDER_WORDS does not call Gemini "pictures only"', () => {
    expect(PROVIDER_WORDS).not.toMatch(/pictures\s+only/)
    expect(PROVIDER_WORDS).toContain('"gemini"')
  })
})
