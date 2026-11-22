// The media tool with the fetched FFmpeg (phase-07.md exit criterion 5). It skips with a message
// when no binary is present, so CI stays green.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createMediaTool } from '@/main/media/embed-details'
import { binaryUsableNow, ffmpegPath } from '@/main/media/ffmpeg-path'
import { checkMp4 } from '@/main/providers/video-check'

const binary = ffmpegPath({
  packaged: false,
  resourcesPath: '',
  appPath: process.cwd(),
  platform: process.platform,
  arch: process.arch,
})
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-embed-real-'))
afterAll(() => fs.rmSync(userData, { recursive: true, force: true }))

const clip = new Uint8Array(fs.readFileSync('tests/fixtures/video/tiny-sound.mp4'))
const details = {
  kind: 'video_generation',
  prompt: 'A paper boat; drifting = slowly #2 \\ done\nend',
  model: 'fake-video',
}

function contains(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, 'utf8'))
}

describe('embedDetails with the fetched FFmpeg', () => {
  it('writes the comment and keeps the sound track and the facts', async (ctx) => {
    if (!binaryUsableNow(binary)) ctx.skip('No FFmpeg here; run npm run fetch:ffmpeg.')
    const log = { write: vi.fn() }
    const tool = createMediaTool({ binary, userData, log })
    expect(tool.available()).toBe(true)

    const out = await tool.embedDetails({ bytes: clip, details })

    expect(log.write).not.toHaveBeenCalled()
    expect(out).not.toBeNull()
    const written = out as Uint8Array
    expect(contains(written, JSON.stringify(details))).toBe(true)
    expect(checkMp4(written)).toEqual(checkMp4(clip))
    expect(checkMp4(written).hasSound).toBe(true)
    expect(fs.readdirSync(path.join(userData, 'media-temp'))).toEqual([])
  })
})
