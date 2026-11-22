// P8-17 (security class short): the ad's sound source is read again from the project and
// checked before FFmpeg sees anything. The variant's sound and the audio asset's row (library,
// kind) are checked; the file is resolved, opened without following a link, sniffed from the
// same handle and copied into the work folder under a fixed name. A clip's own sound is heard
// only when its soundOn is true and its file holds sound.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { clipFiles } from '@/main/export/video/clip-files'
import { adSound, SOUND_REFUSED } from '@/main/export/video/sound-file'
import { setupVideoExport, solidPng } from './video-export-fixture'
import { toneWav } from './tone-wav'

type Setup = Awaited<ReturnType<typeof setupVideoExport>>
let s: Setup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

async function setup() {
  s = await setupVideoExport()
  const t = s
  const project = t.fx.core.deps.projects.requireOpen(t.projectId)
  const work = fs.mkdtempSync(path.join(t.fx.core.deps.userDataDir, 'work-'))
  const setSound = (sound: string, assetId: string | null = null) =>
    project.db
      .prepare('UPDATE variant SET sound = ?, sound_asset_id = ? WHERE id = ?')
      .run(sound, assetId, t.videoId)
  const audio = (id: string, bytes: Uint8Array | null, name = `${id}.wav`) =>
    t.addAsset(id, bytes, { kind: 'audio', mime: 'audio/wav', name, width: null, height: null })
  const sound = () => adSound(t.fx.core.deps, project, t.videoId, work)
  return { t, project, work, setSound, audio, sound }
}

const failure = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error) => e.message,
  )

describe('adSound [P8-17]', () => {
  it.each(['none', 'clips'])('gives the source %s as it is, with no file', async (source) => {
    const { setSound, sound, work } = await setup()
    setSound(source)
    expect(await sound()).toEqual({ source })
    expect(fs.readdirSync(work)).toEqual([])
  })

  it('copies the added WAV into the work folder under a fixed name', async () => {
    const { setSound, audio, sound, work } = await setup()
    const bytes = toneWav(200)
    audio('S1', bytes)
    setSound('file', 'S1')
    const got = await sound()
    expect(got).toEqual({ source: 'file', path: path.join(work, 'sound.wav'), fileType: 'wav' })
    expect(new Uint8Array(fs.readFileSync(path.join(work, 'sound.wav')))).toEqual(bytes)
  })

  it('names the missing sound file', async () => {
    const { setSound, audio, sound } = await setup()
    audio('S1', null, 'Theme tune.wav')
    setSound('file', 'S1')
    expect(await failure(sound())).toBe('A file this ad uses is missing: Theme tune.wav.')
  })

  it.each<[string, (x: Awaited<ReturnType<typeof setup>>) => void]>([
    ['the source is file with no asset', (x) => x.setSound('file')],
    [
      'the asset row is not audio',
      (x) => {
        x.t.addAsset('P1', solidPng({ width: 4, height: 4 }, [0, 0, 0, 255]))
        x.setSound('file', 'P1')
      },
    ],
    [
      'the bytes are a picture though the row says audio',
      (x) => {
        x.audio('S1', solidPng({ width: 4, height: 4 }, [0, 0, 0, 255]))
        x.setSound('file', 'S1')
      },
    ],
    [
      'the asset is in another library',
      (x) => {
        x.audio('S1', toneWav(100))
        x.project.db.prepare("UPDATE asset SET library = 'reference' WHERE id = 'S1'").run()
        x.setSound('file', 'S1')
      },
    ],
  ])('refuses the ad when %s, naming nothing', async (_, arrange) => {
    const x = await setup()
    arrange(x)
    expect(await failure(x.sound())).toBe(SOUND_REFUSED)
    expect(fs.readdirSync(x.work)).toEqual([])
  })
})

describe("a clip's own sound [P8-17]", () => {
  it('is heard only when its soundOn is true and its file holds sound', async () => {
    const { t, project, work } = await setup()
    const video = (id: string, file: string) =>
      t.addAsset(id, fs.readFileSync(`tests/fixtures/video/${file}`), {
        kind: 'video',
        mime: 'video/mp4',
        name: `${id}.mp4`,
        durationMs: 1000,
      })
    video('V1', 'tiny-sound.mp4')
    video('V2', 'tiny.mp4')
    t.addClip('V1', { startMs: 0, outMs: 500 })
    t.addClip('V2', { startMs: 500, outMs: 500 })
    t.addClip('V1', { startMs: 1000, outMs: 500 })
    project.db.prepare("UPDATE background_clip SET sound_on = 0 WHERE id = 'C3'").run()
    const clips = await clipFiles(t.fx.core.deps, project, t.videoId, work)
    expect(clips.map((c) => c.sound)).toEqual([true, false, false])
  })
})
