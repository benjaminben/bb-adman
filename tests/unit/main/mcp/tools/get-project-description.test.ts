// LP-7: get_project's description names every field its picker gives.
import { describe, it, expect } from 'vitest'
import { ALL_TOOLS } from '@/main/mcp/tools/table'
import { projectFields } from '@/main/mcp/tools/project-replies'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'

const sample = {
  meta: {
    projectId: '01J00000000000000000000000',
    name: 'Spring',
    schemaVersion: 1,
    createdAppVersion: '0.1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  subjects: [],
  campaigns: [],
  missingAssetCount: 0,
} as unknown as ProjectGet

describe('get_project description [LP-7]', () => {
  const description = ALL_TOOLS.find((t) => t.name === 'get_project')?.description ?? ''

  it('names each field of the reply', () => {
    const fields = Object.keys(projectFields(sample) as Record<string, unknown>)
    expect(fields).toEqual(['meta', 'subjects', 'campaigns', 'missingAssetCount'])
    for (const field of fields) expect(description).toContain(field)
  })

  it('names what meta holds', () => {
    for (const part of ['project ID', 'name', 'schema version', 'app version', 'created']) {
      expect(description).toContain(part)
    }
  })
})
