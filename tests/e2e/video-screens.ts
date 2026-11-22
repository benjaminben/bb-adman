// Steps for a video from a picture (SPEC 14 1.60 CU-6b-R N-11), shared by the offline spec and
// test:e2e:real: choose the start in the editor's Generate panel (R2E-9), add the pictures
// through the dialog stub, and choose the first. Not a test file itself. No helper here prints
// a value.
import type { ElectronApplication, Page } from '@playwright/test'
import { chooseAddedPicture, VIDEO_REFERENCE_START, VIDEO_SHAPE_START } from './screens'

export const FIRST_FRAME_START = VIDEO_SHAPE_START
export const REFERENCE_START = VIDEO_REFERENCE_START

export const H3_FRAME_LABEL = 'MiniMax H3: video from a first frame'
export const H3_REFERENCE_LABEL = 'MiniMax H3: video from reference pictures'

export async function choosePictureStart(
  app: ElectronApplication,
  page: Page,
  start: string,
  files: string[],
): Promise<void> {
  await chooseAddedPicture(app, page, start, files)
}
