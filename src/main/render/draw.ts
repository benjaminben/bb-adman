// spec/scene.md "One draw": the Electron side. Sends the request to the render window, takes its
// reply only through acceptDone, captures the page and gives a PNG of exactly the asked size.
import { ipcMain, type IpcMainEvent } from 'electron'
import { ulid } from 'ulid'
import type { DrawScene, DrawResult } from '@/main/thumbnails/types'
import type { SceneInput } from '@/shared/scene/types'
import { RENDER_LIMITS } from '@/shared/config/render'
import { RENDER_CHANNELS, RenderRequest } from '@/shared/schemas/render'
import { acceptDone, type DoneExpectation } from './done-message'
import { endRenderWindow, renderWindow, type RenderWindow } from './render-window'

// The render service reads reason: 'timeout' and 'crashed' are logged as given.
class DrawFailure extends Error {
  constructor(readonly reason: 'timeout' | 'crashed' | 'error') {
    super('A picture of a variant could not be drawn.')
  }
}

type Waiting = { expected: DoneExpectation; answer: (overflow: Record<string, boolean>) => void }

export function createDraw(): DrawScene {
  let waiting: Waiting | null = null
  // A reply that fails the check is ignored; the draw then times out.
  ipcMain.on(RENDER_CHANNELS.done, (event: IpcMainEvent, message: unknown) => {
    const overflow = waiting ? acceptDone(event, message, waiting.expected) : null
    if (waiting && overflow) waiting.answer(overflow)
  })

  async function drawOnce(request: RenderRequest, target: RenderWindow): Promise<DrawResult> {
    const { win, loaded } = target
    await loaded
    win.setContentSize(request.width, request.height)
    const textLayerIds = request.input.layers.filter((l) => l.type === 'text').map((l) => l.id)
    const expected = { contents: win.webContents, requestId: request.requestId, textLayerIds }
    const overflow = await new Promise<Record<string, boolean>>((answer) => {
      waiting = { expected, answer }
      win.webContents.send(RENDER_CHANNELS.request, request)
    })
    const image = await win.webContents.capturePage()
    const { width, height } = image.getSize()
    const sized =
      width === request.width && height === request.height
        ? image
        : image.resize({ width: request.width, height: request.height, quality: 'best' })
    return { png: new Uint8Array(sized.toPNG()), overflow }
  }

  // Ends the window and fails on time-out; fails as crashed when the window goes during the draw.
  function limited(request: RenderRequest): Promise<DrawResult> {
    const target = renderWindow()
    return new Promise<DrawResult>((resolve, reject) => {
      let settled = false
      // Only the first outcome counts: a late one must not touch the next draw's state.
      const finish = (outcome: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        waiting = null
        if (!target.win.isDestroyed()) target.win.removeListener('closed', gone)
        outcome()
      }
      const fail = (reason: DrawFailure['reason']) => finish(() => reject(new DrawFailure(reason)))
      const gone = () => fail('crashed')
      const timer = setTimeout(() => {
        fail('timeout')
        endRenderWindow()
      }, RENDER_LIMITS.timeMs)
      target.win.once('closed', gone)
      drawOnce(request, target).then(
        (result) => finish(() => resolve(result)),
        () => fail('error'),
      )
    })
  }

  let queue: Promise<unknown> = Promise.resolve()
  return (input: SceneInput, size: { width: number; height: number }) => {
    const parsed = RenderRequest.safeParse({ requestId: ulid(), input, ...size })
    if (!parsed.success) return Promise.reject(new DrawFailure('error'))
    // One draw at a time: the window has one size and one page.
    const run = queue.then(() => limited(parsed.data))
    queue = run.catch(() => undefined)
    return run
  }
}
