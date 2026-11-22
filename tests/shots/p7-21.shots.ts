// P7-21: the sound choice of a video variant. 234: the clips' own sound, with the made-up clip
// drawn in the canvas. 235: "An audio file" chosen with none stored yet: the list waits for a
// pick, beside "Add audio…". 236: a made-up tone chosen as the sound, paused part way.
import { test, expect } from '@playwright/test'
import { addSoundClip, useAudioFile, writeToneWav } from '../e2e/sound-steps'
import { dragRuler, openVideoEditor, timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('the sound choice: the clips, an audio file to pick, a chosen file', async () => {
  session = await openApp()
  const { app, page, box } = session
  await openVideoEditor(app, page, 'Lemon Fizz')
  await addSoundClip(app, page)
  await expect(page.locator('[data-stage] video')).toHaveCount(1)
  await dragRuler(page, 0.05, 0.03)
  await shot(page, '234-sound-clips')

  await timeline(page).getByRole('combobox', { name: 'Sound' }).selectOption('file')
  await expect(timeline(page).getByRole('combobox', { name: 'Audio file' })).toBeVisible()
  await shot(page, '235-sound-file-pick')

  await useAudioFile(app, page, writeToneWav(box.root, 8, 'summer-tone.wav'))
  await dragRuler(page, 0.1, 0.4)
  await shot(page, '236-sound-file-chosen')
})
