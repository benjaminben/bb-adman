// Steps for a video from a picture (SPEC 14 1.60 CU-6b-R N-11), shared by the offline spec and
// test:e2e:real: choose the start on the "Make a video" card, add the pictures through the
// dialog stub, and choose the first. Not a test file itself. No helper here prints a value.
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import { answerOpenDialog, videoPanel } from './screens'

export const FIRST_FRAME_START = 'A first-frame picture'
export const REFERENCE_START = 'A reference picture'

export const H3_FRAME_LABEL = 'MiniMax H3: video from a first frame'
export const H3_REFERENCE_LABEL = 'MiniMax H3: video from reference pictures'

export async function choosePictureStart(
  app: ElectronApplication,
  page: Page,
  start: string,
  files: string[],
): Promise<void> {
  const panel = videoPanel(page)
  await panel.getByLabel('Provider').selectOption({ label: 'ComfyUI' })
  await panel.getByLabel('Start from').selectOption({ label: start })
  const pictures = panel.getByRole('region', { name: 'Picture to start from' })
  await answerOpenDialog(app, files)
  await pictures.getByRole('button', { name: 'Add pictures' }).click()
  const choices = pictures.getByRole('radio')
  await expect(choices).toHaveCount(files.length)
  await choices.first().check()
  await expect(choices.first()).toBeChecked()
}
