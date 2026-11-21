// The hidden render window's page (spec/scene.md "The render window"). It listens before the
// page finishes loading, so the main process can send the first request once it has loaded.
import { createRoot } from 'react-dom/client'
import type { RenderDone, RenderRequest } from '@/shared/schemas/render'
import { RenderRoot } from './render-root/render-root'

declare global {
  interface Window {
    renderApi: {
      onRequest(listener: (request: RenderRequest) => void): void
      done(reply: RenderDone): void
    }
  }
}

const element = document.getElementById('root')
if (element) {
  const root = createRoot(element)
  const done = (reply: RenderDone) => window.renderApi.done(reply)
  window.renderApi.onRequest((request) =>
    root.render(<RenderRoot key={request.requestId} request={request} onDone={done} />),
  )
}
