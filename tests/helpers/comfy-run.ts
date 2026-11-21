// For CU-4's tests: makes the stand-in answer the check for the shipped workflows, and finish
// a run with a picture. A fake clock stands in for the adapter's waits. Nothing here contacts
// a real server.
import type { StandIn } from './comfy-stand-in'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { RunTiming } from '@/main/providers/comfyui/run'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { greyPng } from '@/main/providers/fake/png'
import { mp4File } from '@/main/providers/fake/mp4'

export const RESULT_PNG = greyPng(4, 4)

// The version the stand-in reports for a run: at least every shipped minimum.
export const SERVER_VERSION = '0.45.0'

// A server version every shipped workflow takes, and every model file the shipped non-draft
// workflows need, under its folder.
export function serveNeeds(stand: StandIn): void {
  stand.reply('GET /system_stats', {
    json: { system: { comfyui_version: SERVER_VERSION }, devices: [{ name: 'stand-in' }] },
  })
  const folders = new Map<string, string[]>()
  for (const w of NON_DRAFT_WORKFLOWS) {
    for (const m of w.needs.models) {
      folders.set(m.folder, [...(folders.get(m.folder) ?? []), m.file])
    }
  }
  for (const [folder, files] of folders) stand.reply(`GET /models/${folder}`, { json: files })
}

export function historyEntry(outputNode: string, extra: Record<string, unknown> = {}) {
  return {
    status: { status_str: 'success', completed: true, messages: [] },
    outputs: {
      [outputNode]: {
        images: [{ filename: 'ComfyUI_temp_0001.png', subfolder: '', type: 'temp' }],
      },
    },
    ...extra,
  }
}

export function finishRun(stand: StandIn, promptId: string, entry: unknown): void {
  stand.reply(`GET /history/${promptId}`, { json: { [promptId]: entry } })
}

export function servePicture(stand: StandIn, bytes: Uint8Array = RESULT_PNG): void {
  stand.reply('GET /view', { body: bytes, headers: { 'content-type': 'image/png' } })
}

export function comfyContext(origin: () => string | null, mcpPort = 1): AdapterContext {
  return {
    secret: () => {
      throw new Error('ComfyUI reads no secret')
    },
    model: () => {
      throw new Error('ComfyUI has no default model')
    },
    settings: () => ({ comfyui: { baseUrl: origin() }, mcp: { port: mcpPort } }) as Settings,
  }
}

export const PROMPT_ID = '0d6a3f5e-1b2c-4d3e-8f40-5a6b7c8d9e0f'

// A fake clock. `onSleep` runs at each wait, after the clock moved on.
export function fakeTiming(onSleep: (step: number) => void | Promise<void> = () => undefined) {
  let clock = 0
  let step = 0
  const timing: RunTiming = {
    now: () => clock,
    newId: () => PROMPT_ID,
    sleep: async (ms) => {
      clock += ms
      step += 1
      await onSleep(step)
    },
  }
  return { timing, at: () => clock }
}

// CU-6a: the clip the stand-in gives, and a finished video run's history entry. SaveVideo
// lists its file under `images`, in the output folder, under the app's adman/ prefix.
export const RESULT_MP4 = mp4File({ width: 384, height: 672, durationMs: 2_333, sound: true })

export function videoHistoryEntry(outputNode: string, promptId: string = PROMPT_ID) {
  const item = { filename: `${promptId}_00001_.mp4`, subfolder: 'adman', type: 'output' }
  return {
    status: { status_str: 'success', completed: true, messages: [] },
    outputs: { [outputNode]: { images: [item], animated: [true] } },
  }
}

export function serveVideo(stand: StandIn, bytes: Uint8Array = RESULT_MP4): void {
  stand.reply('GET /view', { body: bytes, headers: { 'content-type': 'video/mp4' } })
}

export const requestLines = (stand: StandIn) => stand.seen.map((r) => `${r.method} ${r.path}`)
