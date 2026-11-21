// The preload bridge (SPEC 1.3): a typed window.api with command, query and on.
// It sends only names and inputs; the main process sets the actor.
// Beside it, window.drop (spec/security.md "The drop bridge"): one function that gives the
// path of a File the system handed the page, '' for anything else, and never throws.
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, type AdmanApi } from '@/shared/schemas/api'
import type { DropApi } from '@/shared/schemas/drop-api'
import type { EventName } from '@/shared/schemas/events'

type EventMessage = { name: EventName; payload: unknown }

const api: AdmanApi = {
  command: (name, input) => ipcRenderer.invoke(IPC_CHANNELS.command, name, input),
  query: (name, input) => ipcRenderer.invoke(IPC_CHANNELS.query, name, input ?? {}),
  on(event, listener) {
    const handler = (_e: unknown, msg: EventMessage) => {
      if (msg.name === event) listener(msg.payload as Parameters<typeof listener>[0])
    }
    ipcRenderer.on(IPC_CHANNELS.event, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.event, handler)
    }
  },
}

const drop: DropApi = {
  pathOf(file) {
    if (!(file instanceof File)) return ''
    try {
      const found: unknown = webUtils.getPathForFile(file)
      return typeof found === 'string' ? found : ''
    } catch {
      return ''
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('drop', drop)
