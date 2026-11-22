// Bridge mode's pipe (spec/mcp-and-agents.md, "Bridge mode"; P10-9, A-244). MCP messages
// from a client on stdio go to the app's own server at http://127.0.0.1:{port}/mcp with the
// bearer header, and the server's messages come back, each passed on unchanged. The bridge has
// no tools and no rules of its own: the server decides everything, as actor `agent`.
// Electron-free. Nothing read from the client is logged or echoed; the token is written only
// into the Authorization header of a request to that one address.
import type { Readable, Writable } from 'node:stream'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  isInitializeRequest,
  isJSONRPCRequest,
  type JSONRPCMessage,
  type RequestId,
} from '@modelcontextprotocol/sdk/types.js'
import { closedAnswer } from './closed-answer'

// The app's port and token, or null while agent access is off or there is no token.
export type BridgeDoor = { port: number; token: string } | null

// One message from the client may be at most this long; a longer one ends the bridge.
export const MAX_MESSAGE_BYTES = 4 * 1024 * 1024

export function bridgeDoor(mcp: { enabled: boolean; port: number }, token: string | null) {
  return mcp.enabled && token ? { port: mcp.port, token } : null
}

// Every request goes to the one address and follows no redirect, to another host or this one.
function fixedFetch(address: string): typeof fetch {
  return (url, init) => {
    const target = url instanceof Request ? url.url : String(url)
    if (target !== address) return Promise.reject(new Error('The bridge reaches one address only.'))
    return fetch(address, { ...init, redirect: 'error' })
  }
}

function httpSide(door: NonNullable<BridgeDoor>): StreamableHTTPClientTransport {
  const address = `http://127.0.0.1:${door.port}/mcp`
  return new StreamableHTTPClientTransport(new URL(address), {
    requestInit: { headers: { authorization: `Bearer ${door.token}` }, redirect: 'error' },
    fetch: fixedFetch(address),
  })
}

type Opts = { input: Readable; output: Writable; door: BridgeDoor }

// Resolves once the client's input ends, or a message from it is too long.
export function runRelay(opts: Opts): Promise<void> {
  const stdio = new StdioServerTransport(opts.input, opts.output, {
    maxBufferSize: MAX_MESSAGE_BYTES,
  })
  const http = opts.door ? httpSide(opts.door) : null
  const answerClosed = (m: JSONRPCMessage) => {
    const answer = closedAnswer(m)
    if (answer) void stdio.send(answer)
  }
  // Other messages wait for initialize, so they carry the session it opens.
  let initializing: Promise<void> = Promise.resolve()
  let initializeId: RequestId | null = null

  async function toServer(m: JSONRPCMessage): Promise<void> {
    if (!http) return answerClosed(m)
    const first = isJSONRPCRequest(m) && isInitializeRequest(m)
    if (first) initializeId = m.id
    else await initializing
    const sent = http.send(m).catch(() => answerClosed(m))
    if (first) initializing = sent
    await sent
  }

  return new Promise<void>((resolve) => {
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      opts.input.off('end', end)
      void (async () => {
        await stdio.close().catch(() => {})
        await http?.terminateSession().catch(() => {})
        await http?.close().catch(() => {})
        resolve()
      })()
    }
    // A message that is not MCP is dropped; nothing of it is written anywhere.
    stdio.onerror = () => {}
    stdio.onclose = end
    stdio.onmessage = (m) => void toServer(m)
    if (http) {
      http.onerror = () => {}
      http.onmessage = (m) => {
        if (initializeId !== null && !isJSONRPCRequest(m) && 'id' in m && m.id === initializeId) {
          const version = 'result' in m ? m.result.protocolVersion : undefined
          if (typeof version === 'string') http.setProtocolVersion(version)
          initializeId = null
        }
        void stdio.send(m)
      }
    }
    opts.input.once('end', end)
    void http?.start()
    void stdio.start()
  })
}
