// The stand-in ComfyUI's side of a run for the offline spec (SPEC 14 1.56 E2E-R): serve what
// the app's workflows need, find the run the app sent, then move it on. Playwright cannot
// load the workflow modules (they import JSON), so the needs come from the built app's own
// comfy.getInfo. Nothing here contacts a real server. Not a test file itself.
import { expect, type Page } from '@playwright/test'
import type { StandIn } from '../helpers/comfy-stand-in'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { greyPng } from '@/main/providers/fake/png'
import { greyClip } from '../fixtures/video/grey-clip'

// The version the stand-in reports: at least every shipped minimum (as comfy-run.ts).
const SERVER_VERSION = '0.45.0'

type Api = { api: { query: (name: string, input: unknown) => Promise<{ data: unknown }> } }

// Every model file the app's non-draft workflows need, under its folder.
export async function serveNeedsFromApp(page: Page, stand: StandIn): Promise<void> {
  const info = (await page.evaluate(
    async () => (await (window as unknown as Api).api.query('comfy.getInfo', {})).data,
  )) as ComfyInfo
  stand.reply('GET /system_stats', {
    json: { system: { comfyui_version: SERVER_VERSION }, devices: [{ name: 'stand-in' }] },
  })
  const folders = new Map<string, string[]>()
  for (const w of info.workflows.filter((w) => w.status !== 'draft')) {
    for (const m of w.needs.models) {
      folders.set(m.folder, [...(folders.get(m.folder) ?? []), m.file])
    }
  }
  for (const [folder, files] of folders) stand.reply(`GET /models/${folder}`, { json: files })
}

// The prompt IDs of the runs the app has sent so far, oldest first.
export function sentIds(stand: StandIn): string[] {
  return stand.seen
    .filter((r) => r.method === 'POST' && r.path === '/prompt')
    .map((r) => (JSON.parse(r.body.toString('utf8')) as { prompt_id: string }).prompt_id)
}

// Waits for the app's `count`-th run and gives its prompt ID.
export async function nthSentId(stand: StandIn, count: number): Promise<string> {
  await expect.poll(() => sentIds(stand).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(count)
  const id = sentIds(stand)[count - 1]
  if (id === undefined) throw new Error('the run was not sent')
  return id
}

// A run the server still holds in its queue, as a real server lists it. A cancel then finds
// the run there, removes it and reports it stopped (F-15: only a confirmed stop ends a run
// cancelled).
export function waitingInQueue(stand: StandIn, id: string): void {
  stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, id]] } })
}

export function startWorking(stand: StandIn, id: string): void {
  stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
}

function finish(stand: StandIn, id: string, entry: unknown): void {
  stand.reply(`GET /history/${id}`, { json: { [id]: entry } })
}

export function finishWithPicture(stand: StandIn, id: string, outputNode: string): void {
  stand.reply('GET /view', { body: greyPng(4, 4), headers: { 'content-type': 'image/png' } })
  finish(stand, id, {
    status: { status_str: 'success', completed: true, messages: [] },
    outputs: {
      [outputNode]: {
        images: [{ filename: 'ComfyUI_temp_0001.png', subfolder: '', type: 'temp' }],
      },
    },
  })
}

// A finished video run as the real server lists it: SaveVideo's clip under `images`, with
// `animated` beside it; `/view` then serves a clip Chromium can decode (grey-clip.ts says why
// mp4File's header-only file is not used).
export function finishWithVideo(stand: StandIn, id: string, outputNode: string): void {
  stand.reply('GET /view', { body: greyClip(), headers: { 'content-type': 'video/mp4' } })
  finish(stand, id, {
    status: { status_str: 'success', completed: true, messages: [] },
    outputs: {
      [outputNode]: {
        images: [{ filename: 'adman_video_00001.mp4', subfolder: 'video', type: 'output' }],
        animated: [true],
      },
    },
  })
}

// The history of a run the server could not finish (6.10.6), so the row shows Failed.
export function finishWithError(stand: StandIn, id: string): void {
  finish(stand, id, {
    status: {
      status_str: 'error',
      completed: false,
      messages: [['execution_error', { exception_message: 'stand-in failure' }]],
    },
    outputs: {},
  })
}
