import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMediaTool } from '@/main/media/embed-details'
import { ffmetadataText } from '@/main/media/ffmetadata'
import { mp4File } from '@/main/providers/fake/mp4'
import { writeStandIn } from './stand-in'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-embed-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const facts = { width: 64, height: 48, durationMs: 1000, sound: true }
const input = mp4File(facts)
const details = { kind: 'video_generation', prompt: 'A red kite; over hills = calm #1' }

function prepared(name: string, bytes: Uint8Array): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, bytes)
  return file
}

// A stand-in that keeps a copy of what it was given, then writes `from` as its output.
function copyingStandIn(from: string | null, exitCode = 0, stderr = ''): string {
  const seen = JSON.stringify(path.join(dir, 'seen'))
  return writeStandIn(
    dir,
    `const fs = require('fs')
const args = process.argv.slice(2)
fs.rmSync(${seen}, { recursive: true, force: true })
fs.mkdirSync(${seen})
fs.writeFileSync(${seen} + '/args.json', JSON.stringify(args))
fs.copyFileSync('in.mp4', ${seen} + '/in.mp4')
fs.copyFileSync('meta.txt', ${seen} + '/meta.txt')
${from ? `fs.copyFileSync(${JSON.stringify(from)}, args[args.length - 1].slice(5))` : ''}
process.stderr.write(${JSON.stringify(stderr)}, () => process.exit(${exitCode}))`,
  )
}

let userData = ''
let log: { write: ReturnType<typeof vi.fn> }
beforeEach(() => {
  userData = fs.mkdtempSync(path.join(dir, 'user-'))
  log = { write: vi.fn() }
})

function runFoldersLeft(): string[] {
  const temp = path.join(userData, 'media-temp')
  return fs.existsSync(temp) ? fs.readdirSync(temp) : []
}

function logged(): string {
  return JSON.stringify(log.write.mock.calls)
}

describe.skipIf(process.platform === 'win32')('createMediaTool (P7-4)', () => {
  it('gives the written clip when its facts match, and removes the run folder', async () => {
    const out = prepared('good.mp4', mp4File(facts))
    const tool = createMediaTool({ binary: copyingStandIn(out), userData, log })
    expect(tool.available()).toBe(true)
    const result = await tool.embedDetails({ bytes: input, details })
    expect(result && [...result]).toEqual([...mp4File(facts)])
    expect(fs.readFileSync(path.join(dir, 'seen', 'meta.txt'), 'utf8')).toBe(
      ffmetadataText(JSON.stringify(details)),
    )
    expect([...fs.readFileSync(path.join(dir, 'seen', 'in.mp4'))]).toEqual([...input])
    const args: string[] = JSON.parse(fs.readFileSync(path.join(dir, 'seen', 'args.json'), 'utf8'))
    expect(args.join(' ')).not.toContain('A red kite')
    expect(runFoldersLeft()).toEqual([])
  })

  it.each([
    ['a changed size', prepared('wider.mp4', mp4File({ ...facts, width: 128 })), 0],
    ['a lost sound track', prepared('quiet.mp4', mp4File({ ...facts, sound: false })), 0],
    ['a changed length', prepared('longer.mp4', mp4File({ ...facts, durationMs: 2000 })), 0],
    ['a broken file', prepared('broken.mp4', new Uint8Array([0, 0, 0, 8, 1, 2, 3, 4])), 0],
    ['no output', null, 0],
    ['a failed run', prepared('fail.mp4', mp4File(facts)), 1],
  ])('gives null for %s, keeps the original and removes the run folder', async (_n, out, code) => {
    const tool = createMediaTool({ binary: copyingStandIn(out, code), userData, log })
    const before = [...input]
    expect(await tool.embedDetails({ bytes: input, details })).toBeNull()
    expect([...input]).toEqual(before)
    expect(runFoldersLeft()).toEqual([])
    expect(log.write).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn', ok: false }))
  })

  it('logs a fixed reason, never standard error or a path', async () => {
    const stderr = `SECRET ${userData}/media-temp failed`
    const tool = createMediaTool({ binary: copyingStandIn(null, 1, stderr), userData, log })
    expect(await tool.embedDetails({ bytes: input, details })).toBeNull()
    expect(logged()).not.toContain('SECRET')
    expect(logged()).not.toContain(userData)
    expect(logged()).not.toContain('A red kite')
  })

  it('runs nothing for an input that is not an MP4', async () => {
    const tool = createMediaTool({ binary: copyingStandIn(null), userData, log })
    fs.rmSync(path.join(dir, 'seen'), { recursive: true, force: true })
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(await tool.embedDetails({ bytes, details })).toBeNull()
    expect(fs.existsSync(path.join(dir, 'seen'))).toBe(false)
  })

  it('is not available, and writes nothing, without a binary', async () => {
    const tool = createMediaTool({ binary: path.join(dir, 'missing'), userData, log })
    expect(tool.available()).toBe(false)
    expect(await tool.embedDetails({ bytes: input, details })).toBeNull()
    expect(fs.existsSync(path.join(userData, 'media-temp'))).toBe(false)
  })
})
