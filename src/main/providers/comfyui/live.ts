// CU-9 [REQ: FR-269] (security class, A-54): "how far along" from ComfyUI's live connection.
// It listens only: nothing is ever sent on it. A run never depends on it: any failure
// (refused, no connection, closed, too large, bad message) ends the listening in silence, and
// the run carries on by polling. It connects only to the run's own origin, through the
// client's own agent and checked lookup (request.ts `liveTarget`), never to an address from a
// message. No piece of a message reaches a log, an error or the job row (live-messages.ts).
import type http from 'node:http'
import type { LookupFunction } from 'node:net'
import WebSocket from 'ws'
import { CONNECT_MS } from './limits'
import { readLive, type LiveSeen } from './live-messages'

export type LiveTarget = { url: string; secure: boolean; agent: http.Agent; lookup: LookupFunction }

// Fixed settings (spec/comfyui.md "Live progress"). No `origin`: no Origin header is sent.
const LIVE_SETTINGS = {
  maxPayload: 65_536,
  perMessageDeflate: false,
  followRedirects: false,
  handshakeTimeout: CONNECT_MS,
  headers: { 'User-Agent': 'Adman' },
} as const

const nothing = () => undefined

// One per client. The client attaches how to reach its own origin; a run watches its prompt.
export class LiveLink {
  private target: (() => LiveTarget | null) | null = null
  private readonly still: () => boolean

  // `still` says the saved address is still the run's origin (session.ts).
  constructor(still: () => boolean = () => true) {
    this.still = still
  }

  attach(target: () => LiveTarget | null): void {
    this.target = target
  }

  // Opens one listening connection for one run. Gives the function that closes it; calling it
  // again, or after the connection ended, does nothing.
  watch(promptId: string, onSeen: (seen: Exclude<LiveSeen, 'ended'>) => void): () => void {
    const target = this.still() ? this.target?.() : null
    if (!target) return nothing
    let socket: WebSocket
    try {
      socket = new WebSocket(target.url, {
        ...LIVE_SETTINGS,
        headers: { ...LIVE_SETTINGS.headers },
        agent: target.agent,
        lookup: target.lookup,
        ...(target.secure && { rejectUnauthorized: true }),
      })
    } catch {
      return nothing
    }
    let ended = false
    const stop = () => {
      if (ended) return
      ended = true
      socket.removeAllListeners()
      // terminate during the handshake reports an error later; it is kept silent.
      socket.on('error', nothing)
      socket.terminate()
    }
    socket.on('message', (data, isBinary) => {
      // A binary message is dropped unread.
      if (isBinary) return
      const seen = readLive(data.toString('utf8'), promptId)
      if (seen === 'ended') stop()
      else if (seen) onSeen(seen)
    })
    socket.on('error', stop)
    socket.on('close', stop)
    return stop
  }
}
