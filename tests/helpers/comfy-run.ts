// For CU-4's tests: makes the stand-in answer the check for the shipped workflows, and finish
// a run with a picture. A fake clock stands in for the adapter's waits. Nothing here contacts
// a real server.
import type { StandIn } from './comfy-stand-in'
import { NON_DRAFT_WORKFLOWS } from '../../src/main/providers/comfyui/workflows'
import type { RunTiming } from '../../src/main/providers/comfyui/run'
import type { AdapterContext } from '../../src/main/providers/types'
import type { Settings } from '../../src/shared/schemas/settings'
import { greyPng } from '../../src/main/providers/fake/png'

export const RESULT_PNG = greyPng(4, 4)

// Every model file the shipped non-draft workflows need, under its folder.
export function serveModels(stand: StandIn): void {
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

export const requestLines = (stand: StandIn) => stand.seen.map((r) => `${r.method} ${r.path}`)
