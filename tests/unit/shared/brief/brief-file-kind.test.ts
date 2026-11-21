import { describe, it, expect } from 'vitest'
import { briefFileKind } from '@/shared/brief/brief-file-kind'

describe('briefFileKind [spec/ai-jobs.md "Brief reading"]', () => {
  it.each([
    ['/b/brief.json', 'structured'],
    ['/b/brief.yaml', 'structured'],
    ['/b/brief.yml', 'structured'],
    ['/b/BRIEF.JSON', 'structured'],
    ['/b/brief.Yml', 'structured'],
    ['/b/brief.md', 'text'],
    ['/b/brief.markdown', 'text'],
    ['/b/brief.txt', 'text'],
    ['/b/BRIEF.MD', 'text'],
    ['/b/brief.TxT', 'text'],
    ['C:\\briefs\\brief.Markdown', 'text'],
    ['brief.md', 'text'],
    ['/b/brief.pdf', null],
    ['/b/brief.docx', null],
    ['/b/brief', null],
    ['/b/.md', null],
    ['/b/brief.md.exe', null],
    ['/b.md/brief', null],
    ['', null],
  ])('gives %j the kind %j', (path, kind) => {
    expect(briefFileKind(path)).toBe(kind)
  })
})
