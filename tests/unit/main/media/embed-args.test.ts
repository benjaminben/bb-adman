import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { embedArgs, embedPaths } from '@/main/media/embed-args'

const folder = path.resolve('/data/media-temp/run-01JD0000000000000000000000')
const paths = embedPaths(folder)

describe('embedArgs (phase-07.md, "The embed arguments")', () => {
  it('builds the exact argument list', () => {
    expect(embedArgs(folder, paths)).toEqual([
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'mov',
      '-i',
      `file:${path.join(folder, 'in.mp4')}`,
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      'ffmetadata',
      '-i',
      `file:${path.join(folder, 'meta.txt')}`,
      '-map',
      '0:v',
      '-map',
      '0:a?',
      '-map_metadata',
      '1',
      '-c',
      'copy',
      '-f',
      'mp4',
      '-n',
      `file:${path.join(folder, 'out.mp4')}`,
    ])
  })

  it('prefixes every path with file:', () => {
    const args = embedArgs(folder, paths)
    const withPaths = args.filter((a) => a.includes(folder))
    expect(withPaths).toHaveLength(3)
    for (const a of withPaths) expect(a.startsWith('file:')).toBe(true)
  })

  it('pins a demuxer and the protocol list before every input', () => {
    const args = embedArgs(folder, paths)
    args.forEach((a, i) => {
      if (a !== '-i') return
      expect(args.slice(i - 4, i)).toEqual(['-protocol_whitelist', 'file,pipe', '-f', args[i - 1]])
    })
  })

  it('never lets the mov demuxer follow references to other files', () => {
    expect(embedArgs(folder, paths).join(' ')).not.toContain('enable_drefs')
  })

  it.each([
    ['input', { ...paths, input: path.resolve('/elsewhere/in.mp4') }],
    ['meta', { ...paths, meta: path.join(folder, '..', 'meta.txt') }],
    ['output', { ...paths, output: path.join(folder, 'sub', 'out.mp4') }],
    ['relative', { ...paths, output: 'out.mp4' }],
  ])('throws when the %s path is not inside the run folder', (_name, bad) => {
    expect(() => embedArgs(folder, bad)).toThrow()
  })

  it('throws when the folder is not absolute', () => {
    expect(() => embedArgs('run-x', embedPaths('run-x'))).toThrow()
  })
})
