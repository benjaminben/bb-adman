// R2P-1 (spec/phases/round-2-platform.md, D5, D6, D8): the three Round 2 command inputs. Each is
// strict, so an unknown key (an actor or a place among them) is refused. The path text rules
// of D5 are the command's, not the schema's; the schema bounds the list at 1 to 20.
import { describe, it, expect } from 'vitest'
import { assetImportFilesInput } from '@/shared/schemas/commands/asset-files'
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import { projectCreateDefaultInput } from '@/shared/schemas/commands/project-default'

const projectId = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const paths = (n: number) => Array.from({ length: n }, (_, i) => `/Users/me/Pictures/p${i}.png`)

describe('assetImportFilesInput [R2P-1, D5]', () => {
  it('takes a project, 1 to 20 paths and a library, asset by default', () => {
    expect(assetImportFilesInput.parse({ projectId, paths: paths(1) })).toEqual({
      projectId,
      paths: paths(1),
      library: 'asset',
    })
    const twenty = { projectId, paths: paths(20), library: 'reference' }
    expect(assetImportFilesInput.parse(twenty)).toEqual(twenty)
  })

  it.each([
    ['an unknown key', { projectId, paths: paths(1), actor: 'user' }],
    ['0 paths', { projectId, paths: [] }],
    ['21 paths', { projectId, paths: paths(21) }],
    ['no projectId', { paths: paths(1) }],
    ['an empty projectId', { projectId: '', paths: paths(1) }],
    ['a library that is not asset or reference', { projectId, paths: paths(1), library: 'x' }],
    ['a path that is not text', { projectId, paths: [42] }],
  ])('refuses %s', (_label, input) => {
    expect(assetImportFilesInput.safeParse(input).success).toBe(false)
  })
})

describe('campaignFromBriefInput [R2P-1, D6]', () => {
  it('takes a project and the brief text', () => {
    const input = { projectId, text: '# Spring Glow launch' }
    expect(campaignFromBriefInput.parse(input)).toEqual(input)
  })

  it.each([
    ['an unknown key', { projectId, text: 'x', location: '/tmp' }],
    ['an empty text', { projectId, text: '' }],
    ['no text', { projectId }],
    ['no projectId', { text: 'x' }],
  ])('refuses %s', (_label, input) => {
    expect(campaignFromBriefInput.safeParse(input).success).toBe(false)
  })
})

describe('projectCreateDefaultInput [R2P-1, D8]', () => {
  it('takes a name only', () => {
    expect(projectCreateDefaultInput.parse({ name: 'Spring Work' })).toEqual({
      name: 'Spring Work',
    })
  })

  it.each([
    ['an unknown key (a place)', { name: 'Spring Work', location: '/tmp' }],
    ['an empty name', { name: '' }],
    ['a name with a slash', { name: 'a/b' }],
    ['a name with a backslash', { name: 'a\\b' }],
    ['a name with a colon', { name: 'a:b' }],
    ['a name with a control character', { name: 'a\u0007b' }],
    ['a leading dot', { name: '.hidden' }],
    ['a reserved Windows name', { name: 'CON' }],
    ['101 characters', { name: 'a'.repeat(101) }],
  ])('refuses %s', (_label, input) => {
    expect(projectCreateDefaultInput.safeParse(input).success).toBe(false)
  })
})
