// P7-21 (spec/phases/phase-07-slices-2.md): the "Sound" choice in the built app. For each
// choice, which element is unmuted while playing; nothing is unmuted or playing before Play;
// the <audio> time follows a scrub; Pause stops it. Every media address is adman-asset://.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { dragRuler, openVideoEditor, timeline } from './timeline-seed'
import { addSoundClip, mediaStates, useAudioFile, writeToneWav } from './sound-steps'

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

const play = (page: Page) => timeline(page).getByRole('button', { name: 'Play' })
const pause = (page: Page) => timeline(page).getByRole('button', { name: 'Pause' })
const sound = (page: Page) => timeline(page).getByRole('combobox', { name: 'Sound' })

// The one unmuted element's tag while it plays, or 'none'.
async function heard(page: Page): Promise<string> {
  const loud = (await mediaStates(page)).filter((m) => !m.muted && !m.paused)
  if (loud.length > 1) return 'several'
  return loud[0]?.tag ?? 'none'
}

async function quiet(page: Page) {
  const states = await mediaStates(page)
  expect(states.length).toBeGreaterThan(0)
  for (const m of states) {
    expect(m.src).toMatch(/^adman-asset:\/\/[^/]+\/[^/]+$/)
    expect(m.muted).toBe(true)
    expect(m.paused).toBe(true)
  }
}

const audioTime = async (page: Page) =>
  (await mediaStates(page)).find((m) => m.tag === 'audio')?.t ?? -1

test('each sound choice: which element is heard; the audio follows a scrub and stops on pause', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  await openVideoEditor(app, page, 'Sound Check')
  await addSoundClip(app, page)

  // The clips' own sound (the default): quiet until Play, then the clip's video.
  await expect(sound(page)).toHaveValue('clips')
  await quiet(page)
  await dragRuler(page, 0.05, 0.02)
  await quiet(page)
  await play(page).click()
  await expect.poll(() => heard(page)).toBe('video')
  await pause(page).click()
  await expect.poll(() => heard(page)).toBe('none')
  await quiet(page)

  // An audio file: one <audio>, quiet until Play; a scrub moves its time.
  await useAudioFile(app, page, writeToneWav(box.root))
  await expect(sound(page)).toHaveValue('file')
  await quiet(page)
  await dragRuler(page, 0.1, 0.5)
  await expect.poll(() => audioTime(page)).toBeGreaterThan(3.5)
  expect(await audioTime(page)).toBeLessThan(4.5)
  await quiet(page)
  await play(page).click()
  await expect.poll(() => heard(page)).toBe('audio')
  await expect.poll(() => audioTime(page)).toBeGreaterThan(4.2)
  await pause(page).click()
  await expect.poll(() => heard(page)).toBe('none')
  const held = await audioTime(page)
  await page.waitForTimeout(400)
  expect(await audioTime(page)).toBe(held)
  await quiet(page)

  // None: no <audio>, and Play leaves every element muted.
  await sound(page).selectOption('none')
  await expect(page.locator('audio')).toHaveCount(0)
  await dragRuler(page, 0.5, 0.02)
  await play(page).click()
  await expect(pause(page)).toBeVisible()
  await page.waitForTimeout(400)
  expect(await heard(page)).toBe('none')
  for (const m of await mediaStates(page)) expect(m.muted).toBe(true)
  await pause(page).click()

  // Back to the file: the stored file is used again without a pick.
  await sound(page).selectOption('file')
  await expect(page.locator('audio[data-sound-player]')).toHaveCount(1)
  await expect(timeline(page).getByRole('combobox', { name: 'Audio file' })).toHaveValue(/.+/)
})
