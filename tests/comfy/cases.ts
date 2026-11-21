// SPEC 14 1.41 CU-5a cases 2 to 5, 1.46, and 1.54 P-4 cases 6 and 7: the run cases, at
// client level. Each first runs the check for its own workflow (systemStats first, N-03) and
// skips with one line when anything is missing. Runs are the smallest that prove the point:
// the first-run size, 56 frames. The shared steps are in case-steps.ts.
import { flux3KleinEditReferences } from '@/main/providers/comfyui/workflows/flux3'
import {
  h3ImageToVideo,
  h3ReferenceToVideo,
  h3TextToVideo,
} from '@/main/providers/comfyui/workflows/h3'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { MAX_PICTURE_BYTES, MAX_VIDEO_BYTES } from '@/main/providers/picture-limits'
import { pictureToSend } from './given-picture'
import {
  checkPicture,
  checkVideo,
  missingFor,
  runAndReport,
  sendPicture,
  smallest,
  type CaseKit,
  type CaseOutcome,
} from './case-steps'

export type { CaseKit, CaseOutcome } from './case-steps'

const PICTURE_PROMPT = 'A red cube and a blue sphere on a plain light table, studio light'
const REFERENCE_PROMPT = 'The same shapes and colours, drawn as a watercolour painting'
const VIDEO_PROMPT = 'A red cube slowly turning on a plain light table, studio light'
const FRAME_PROMPT =
  'The object in the picture stays in place while the camera slowly pushes in, soft studio light'
const REF_VIDEO_PROMPT =
  'Use <Picture 1> as the product. It stands on a plain light table while the camera slowly circles it, soft studio light'
const FRAMES = 56

// Case 5 (1.46, 1.54 P-3): one picture from a reference picture: the given one when
// ADMAN_COMFY_PICTURE is set, else the test-made one. Only with ADMAN_COMFY_FLUX=1 set in the
// terminal (1.53 G-12). The given picture is checked before any call; only its bytes are sent,
// under uploadName, and no line names its path or file.
export async function referenceCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_FLUX !== '1') {
    return { skip: 'ADMAN_COMFY_FLUX is not 1, so the Flux reference case does not run.' }
  }
  const picture = pictureToSend(kit.env)
  const spec = flux3KleinEditReferences
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const name = await sendPicture(kit, picture)
  const values = { prompt: REFERENCE_PROMPT, references: [name] }
  await runAndReport(kit, spec, version, values, MAX_PICTURE_BYTES, checkPicture(kit))
  if (picture.type !== 'image/jpeg') {
    kit.print(
      'No JPEG run is made; the only JPEG in tests/ is a 1×1 picture inside a Gemini fixture.',
    )
  }
  return { done: true }
}

// Case 3: one MOSS picture at the smallest first-run size, only with ADMAN_COMFY_MOSS=1 set
// in the terminal (1.53 G-12).
export async function pictureCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_MOSS !== '1') {
    return { skip: 'ADMAN_COMFY_MOSS is not 1, so the MOSS picture case does not run.' }
  }
  const spec = mossTextToImage
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const values = { prompt: PICTURE_PROMPT, ...smallest(spec) }
  await runAndReport(kit, spec, version, values, MAX_PICTURE_BYTES, checkPicture(kit))
  return { done: true }
}

// Case 2: one H3 clip, only with ADMAN_COMFY_VIDEO=1 set in the terminal.
export async function videoCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_VIDEO !== '1') {
    return { skip: 'ADMAN_COMFY_VIDEO is not 1, so the video case does not run.' }
  }
  const spec = h3TextToVideo
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const values = { prompt: VIDEO_PROMPT, ...smallest(spec), frames: FRAMES }
  await runAndReport(kit, spec, version, values, MAX_VIDEO_BYTES, checkVideo(kit))
  return { done: true }
}

// Case 6 (1.54 P-4): one H3 clip from a first frame, only with ADMAN_COMFY_FRAME=1 set in the
// terminal. The picture follows case 5's rules (P-1): the given one or the test-made one,
// checked before any call, its bytes alone sent under uploadName.
export async function firstFrameCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_FRAME !== '1') {
    return { skip: 'ADMAN_COMFY_FRAME is not 1, so the first-frame video case does not run.' }
  }
  const picture = pictureToSend(kit.env)
  const spec = h3ImageToVideo
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const firstFrame = await sendPicture(kit, picture)
  const values = { prompt: FRAME_PROMPT, ...smallest(spec), frames: FRAMES, firstFrame }
  await runAndReport(kit, spec, version, values, MAX_VIDEO_BYTES, checkVideo(kit))
  return { done: true }
}

// Case 7 (1.54 P-4 part 2): one H3 clip from one reference picture, only with
// ADMAN_COMFY_REFVIDEO=1 set in the terminal. The picture follows case 5's rules (P-1); the
// workflow drops its second reference slot.
export async function referenceVideoCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_REFVIDEO !== '1') {
    return { skip: 'ADMAN_COMFY_REFVIDEO is not 1, so the reference video case does not run.' }
  }
  const picture = pictureToSend(kit.env)
  const spec = h3ReferenceToVideo
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const references = [await sendPicture(kit, picture)]
  const values = { prompt: REF_VIDEO_PROMPT, ...smallest(spec), frames: FRAMES, references }
  await runAndReport(kit, spec, version, values, MAX_VIDEO_BYTES, checkVideo(kit))
  return { done: true }
}
