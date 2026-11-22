// P7-21: steps for the sound spec and its shots. A made-up sound file (one quiet tone, written
// by the test into its sandbox), tiny-sound.mp4 on the track, and reads of the media elements
// in the editor. Not a test file itself.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { answerOpenDialog } from './screens'
import { timeline } from './timeline-seed'

export const TINY_SOUND = path.resolve('tests/fixtures/video/tiny-sound.mp4')

// A mono 16-bit PCM WAV of one 440 Hz tone at a low level, `seconds` long.
export function writeToneWav(dir: string, seconds = 8, name = 'quiet-tone.wav'): string {
  const rate = 8000
  const samples = rate * seconds
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 2000), i * 2)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVE', 8)
  head.write('fmt ', 12)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20) // PCM
  head.writeUInt16LE(1, 22) // mono
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(data.length, 40)
  const file = path.join(dir, name)
  fs.writeFileSync(file, Buffer.concat([head, data]))
  return file
}

// Imports tiny-sound.mp4 through "Add clip…" and puts it on the track.
export async function addSoundClip(app: ElectronApplication, page: Page): Promise<void> {
  await answerOpenDialog(app, [TINY_SOUND])
  await timeline(page).getByRole('button', { name: 'Add clip…' }).click()
  await timeline(page).getByRole('button', { name: 'Import…' }).click()
  const list = timeline(page).getByRole('list', { name: 'Pictures and videos' })
  await list.getByRole('button', { name: 'tiny-sound.mp4' }).click()
  await expect(timeline(page).getByRole('list', { name: 'Clips' }).getByRole('button')).toHaveCount(
    1,
  )
}

// Chooses "Audio file" and brings `file` in through "Add audio…".
export async function useAudioFile(app: ElectronApplication, page: Page, file: string) {
  await timeline(page).getByRole('combobox', { name: 'Sound' }).selectOption('file')
  await answerOpenDialog(app, [file])
  await timeline(page).getByRole('button', { name: 'Add audio…' }).click()
  await expect(page.locator('audio[data-sound-player]')).toHaveCount(1)
}

export type MediaState = { tag: string; src: string; muted: boolean; paused: boolean; t: number }

// Every <video> and <audio> in the window, in document order.
export function mediaStates(page: Page): Promise<MediaState[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLMediaElement>('video, audio')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      src: el.getAttribute('src') ?? '',
      muted: el.muted,
      paused: el.paused,
      t: el.currentTime,
    })),
  )
}
