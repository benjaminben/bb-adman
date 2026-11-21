// The render window's bridge (spec/security.md "Rules: the render window"): window.renderApi
// with onRequest and done, and nothing else. It listens on the request channel and sends on
// the done channel only. The main process checks every reply (acceptDone).
import { contextBridge, ipcRenderer } from 'electron'
import { RENDER_CHANNELS, type RenderDone, type RenderRequest } from '@/shared/schemas/render'

const renderApi = {
  onRequest(listener: (request: RenderRequest) => void): void {
    ipcRenderer.on(RENDER_CHANNELS.request, (_event, request: RenderRequest) => listener(request))
  },
  done(reply: RenderDone): void {
    ipcRenderer.send(RENDER_CHANNELS.done, reply)
  },
}

contextBridge.exposeInMainWorld('renderApi', renderApi)
