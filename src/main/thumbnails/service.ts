// spec/scene.md, "The render service". A stand-in until slice P3-7 replaces the body: it
// draws nothing, writes nothing and sends nothing.
import type { RenderService, RenderServiceOptions } from './types'

export function createRenderService(_opts: RenderServiceOptions): RenderService {
  return {
    async thumbnail() {
      return { state: 'failed', rev: 0 }
    },
    async render() {
      throw new Error('render is not available')
    },
    onEvent() {},
    async projectClosed() {},
  }
}
