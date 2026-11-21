// SPEC 14 1.41 CU-5a cases 2 to 5, 1.46: the run cases, at client level. Each first runs the
// check for its own workflow (systemStats first, N-03) and skips with one line when anything
// is missing. Runs are the smallest that prove the point: the first-run size, 56 frames.
// Each result is written to the system's temporary folder and its path printed.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { ComfyClient } from '../../src/main/providers/comfyui/client'
import { fillWorkflow, type FillValues } from '../../src/main/providers/comfyui/fill'
import { checkServer } from '../../src/main/providers/comfyui/needs'
import { uploadName } from '../../src/main/providers/comfyui/values'
import { flux3KleinEditReferences } from '../../src/main/providers/comfyui/workflows/flux3'
import { h3TextToVideo } from '../../src/main/providers/comfyui/workflows/h3'
import { mossTextToImage } from '../../src/main/providers/comfyui/workflows/moss'
import type { WorkflowSpec } from '../../src/main/providers/comfyui/workflows/types'
import { MAX_PICTURE_BYTES, MAX_VIDEO_BYTES } from '../../src/main/providers/picture-limits'
import { pictureSize } from '../../src/main/providers/picture-size'
import { pictureType } from '../../src/main/providers/picture-type'
import { fitSize } from '../../src/shared/comfy/fit-size'
import type { Print } from './print'
import { pictureToSend } from './given-picture'
import { fieldNames, runGraph, type RunResult, type Timing } from './run-graph'

export type CaseKit = {
  client: ComfyClient
  print: Print
  timing: Timing
  outDir: string
  env: Record<string, string | undefined>
  newId?: () => string
  // Case 4 prints the field names after the first run that ended, once in all.
  fieldNames: { shown: boolean }
}

export type CaseOutcome = { done: true } | { skip: string }

const PICTURE_PROMPT = 'A red cube and a blue sphere on a plain light table, studio light'
const REFERENCE_PROMPT = 'The same shapes and colours, drawn as a watercolour painting'
const VIDEO_PROMPT = 'A red cube slowly turning on a plain light table, studio light'
const FRAMES = 56

// The smallest square size a workflow's size rule allows.
const smallest = (spec: WorkflowSpec) => fitSize({ width: 1, height: 1 }, spec.size)

// The case's own check: a skip line when anything is missing, and the server's version, which
// the time-out rule needs (SPEC 6.10.14).
async function missingFor(
  kit: CaseKit,
  spec: WorkflowSpec,
): Promise<{ skip: string | null; version: string | undefined }> {
  const result = await checkServer(kit.client, [spec])
  if (result.outcome !== 'ok') throw new Error(`The check ended: ${result.outcome}`)
  const count = result.workflows[0]?.missing.length ?? 0
  const skip = count === 0 ? null : `${spec.id}: ${count} items missing, so it does not run.`
  return { skip, version: result.version }
}

async function showFieldNames(kit: CaseKit, run: RunResult, id: string): Promise<void> {
  if (kit.fieldNames.shown) return
  kit.fieldNames.shown = true
  const job = run.job ?? (await kit.client.jobState(id))
  kit.print(`History entry fields: ${fieldNames(run.entry).join(', ')}`)
  kit.print(job ? `Job state fields: ${fieldNames(job).join(', ')}` : 'Job state: no such route')
}

// Runs, prints the facts, checks the bytes, then writes them. The file is named by what the
// bytes are, never by the server's name for them.
async function runAndReport(
  kit: CaseKit,
  spec: WorkflowSpec,
  version: string | undefined,
  values: Omit<FillValues, 'promptId'>,
  maxBytes: number,
  checked: (bytes: Uint8Array) => string,
): Promise<void> {
  const id = kit.newId?.() ?? randomUUID()
  const withId = spec.slots.outputPrefix ? { ...values, promptId: id } : values
  const graph = fillWorkflow(spec, withId)
  const { client, print, timing } = kit
  const run = await runGraph(client, spec, graph, id, print, timing, maxBytes, version)
  await showFieldNames(kit, run, id)
  const seconds = (ms: number) => `${Math.round(ms / 1000)} s`
  kit.print(`Time waiting: ${seconds(run.waitingMs)}, time working: ${seconds(run.workingMs)}`)
  kit.print(`Byte size: ${run.bytes.byteLength}`)
  const ext = checked(run.bytes)
  const file = path.join(kit.outDir, `adman-comfy-${spec.id}-${Date.now()}${ext}`)
  fs.writeFileSync(file, run.bytes)
  kit.print(`Written to: ${file}`)
}

// A picture passes when pictureType says PNG or JPEG.
const checkPicture = (kit: CaseKit) => (bytes: Uint8Array) => {
  const type = pictureType(bytes)
  if (!type) throw new Error('The result is not a PNG or JPEG')
  const size = pictureSize(bytes, type)
  kit.print(`Pixel size: ${size.width} x ${size.height}`)
  return type === 'image/png' ? '.png' : '.jpg'
}

// A clip passes when it starts with an ftyp box; viewFile has already held it under the limit.
function checkVideo(bytes: Uint8Array): string {
  const box = Buffer.from(bytes.subarray(4, 8)).toString('latin1')
  if (box !== 'ftyp') throw new Error('The result does not start with an ftyp box')
  return '.mp4'
}

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
  const kept = await kit.client.uploadImage(uploadName(picture.bytes), picture.bytes)
  const which = picture.kind === 'given' ? 'the given picture' : 'the test-made picture'
  const type = picture.type === 'image/png' ? 'PNG' : 'JPEG'
  kit.print(`Picture sent: ${which}, ${type}, ${picture.width} x ${picture.height}`)
  const name = kept.subfolder === '' ? kept.name : `${kept.subfolder}/${kept.name}`
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
  await runAndReport(kit, spec, version, values, MAX_VIDEO_BYTES, checkVideo)
  return { done: true }
}
