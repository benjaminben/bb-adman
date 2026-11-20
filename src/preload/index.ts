// The preload bridge (SPEC 1.3): a typed window.api with command, query and on.
// It sends only names and inputs; the main process sets the actor.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AdmanApi } from '../shared/schemas/api'
import type { EventName } from '../shared/schemas/events'

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

contextBridge.exposeInMainWorld('api', api)
