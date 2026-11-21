// P8-15 (security class): the report still is read from the work file only, onto stdout.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { workVideoPath } from '@/main/export/video/encoder-args'
import { stillArgs } from '@/main/export/video/still-args'

const workDir = path.resolve('/work/export-work/01HZZZZZZZZZZZZZZZZZZZZZZZ')

describe('stillArgs [P8-15]', () => {
  it('takes one PNG frame at half the length of the work file onto pipe:1', () => {
    const args = stillArgs(workDir, 15000)
    const i = args.indexOf('-i')
    expect(args.slice(i - 6, i + 2)).toEqual([
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'mov',
      '-ss',
      '7.500',
      '-i',
      `file:${workVideoPath(workDir)}`,
    ])
    expect(args.slice(i + 2)).toEqual([
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-c:v',
      'png',
      'pipe:1',
    ])
    expect(args.filter((a) => a === '-i')).toHaveLength(1)
  })

  it('refuses a work folder that is not absolute or a length that is not a number', () => {
    expect(() => stillArgs('work', 1000)).toThrow()
    expect(() => stillArgs(workDir, Number.NaN)).toThrow()
  })
})
