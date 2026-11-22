// Review fix (spec/phases/phase-07.md "How FFmpeg is run"): the two FFmpeg options that make
// the MOV demuxer follow a data reference to another file appear nowhere in the app's source.
// Only the control in tests/integration/export/ffmpeg-no-network.test.ts passes them.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const FLAGS = ['enable_drefs', 'use_absolute_path']

function filesUnder(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })
}

describe('no data-reference option in the source', () => {
  it('no file under src/ names enable_drefs or use_absolute_path', () => {
    const files = filesUnder(path.resolve('src'))
    expect(files.length).toBeGreaterThan(0)
    const naming = files.filter((file) => {
      const text = fs.readFileSync(file, 'latin1')
      return FLAGS.some((flag) => text.includes(flag))
    })
    expect(naming).toEqual([])
  })
})
