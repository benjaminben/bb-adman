// SPEC 14 1.41 CU-5a, 1.46, 1.54 P-1 and P-4, 1.58 J-1: the steps the run cases in cases.ts
// share. The case's own check, the upload of one picture's bytes, the run, and the checks of
// what came back. Each result is written to the system's temporary folder and its path printed.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { ComfyClient } from '../../src/main/providers/comfyui/client'
import { fillWorkflow, type FillValues } from '../../src/main/providers/comfyui/fill'
import { checkServer } from '../../src/main/providers/comfyui/needs'
import { uploadName } from '../../src/main/providers/comfyui/values'
import type { WorkflowSpec } from '../../src/main/providers/comfyui/workflows/types'
import { pictureSize } from '../../src/main/providers/picture-size'
import { pictureType } from '../../src/main/providers/picture-type'
import { fitSize } from '../../src/shared/comfy/fit-size'
import type { Print } from './print'
import type { SentPicture } from './given-picture'
import { fieldNames, runGraph, type RunResult, type Timing } from './run-graph'
import { checkClip } from './video-facts'

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

// The smallest square size a workflow's size rule allows.
export const smallest = (spec: WorkflowSpec) => fitSize({ width: 1, height: 1 }, spec.size)

// The case's own check: a skip line when anything is missing, and the server's version, which
// the time-out rule needs (SPEC 6.10.14).
export async function missingFor(
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
export async function runAndReport(
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
export const checkPicture = (kit: CaseKit) => (bytes: Uint8Array) => {
  const type = pictureType(bytes)
  if (!type) throw new Error('The result is not a PNG or JPEG')
  const size = pictureSize(bytes, type)
  kit.print(`Pixel size: ${size.width} x ${size.height}`)
  return type === 'image/png' ? '.png' : '.jpg'
}

// A clip passes when it starts with an ftyp box and checkMp4 accepts it (1.58 J-1); viewFile
// has already held it under the limit.
export const checkVideo = (kit: CaseKit) => (bytes: Uint8Array) => {
  const box = Buffer.from(bytes.subarray(4, 8)).toString('latin1')
  if (box !== 'ftyp') throw new Error('The result does not start with an ftyp box')
  checkClip(bytes, kit.print)
  return '.mp4'
}

// Uploads the picture's bytes alone under uploadName and says which picture went, never its
// path or file. Returns the name the server keeps it under.
export async function sendPicture(kit: CaseKit, picture: SentPicture): Promise<string> {
  const kept = await kit.client.uploadImage(uploadName(picture.bytes), picture.bytes)
  const which = picture.kind === 'given' ? 'the given picture' : 'the test-made picture'
  const type = picture.type === 'image/png' ? 'PNG' : 'JPEG'
  kit.print(`Picture sent: ${which}, ${type}, ${picture.width} x ${picture.height}`)
  return kept.subfolder === '' ? kept.name : `${kept.subfolder}/${kept.name}`
}
