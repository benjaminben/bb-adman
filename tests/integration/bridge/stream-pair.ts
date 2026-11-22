// A client end on a pair of streams, for the bridge tests: what the client writes goes to the
// relay's input, what the relay writes comes back. Everything written either way is kept, so
// a test can check that no token passed. Not a test file.
import { PassThrough } from 'node:stream'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export type StreamPair = {
  // The relay reads this and writes that.
  input: PassThrough
  output: PassThrough
  // Every byte written to either stream, as text.
  written: () => string
  // Only what the relay wrote.
  wrote: () => string
  // The next message the relay wrote, in order.
  next: () => Promise<JSONRPCMessage>
  // Writes one raw line (or anything) to the relay's input.
  write: (text: string) => void
  transport: () => Transport
}

export function streamPair(): StreamPair {
  const input = new PassThrough()
  const output = new PassThrough()
  const chunks: string[] = []
  const out: string[] = []
  input.on('data', (c: Buffer) => chunks.push(c.toString('utf8')))
  const buffer = new ReadBuffer()
  const queue: JSONRPCMessage[] = []
  const waiting: Array<(m: JSONRPCMessage) => void> = []
  let listener: ((m: JSONRPCMessage) => void) | null = null
  output.on('data', (c: Buffer) => {
    chunks.push(c.toString('utf8'))
    out.push(c.toString('utf8'))
    buffer.append(c)
    for (let m = buffer.readMessage(); m; m = buffer.readMessage()) {
      if (listener) listener(m)
      else if (waiting.length > 0) waiting.shift()?.(m)
      else queue.push(m)
    }
  })
  return {
    input,
    output,
    written: () => chunks.join(''),
    wrote: () => out.join(''),
    next: () => {
      const ready = queue.shift()
      return ready ? Promise.resolve(ready) : new Promise((resolve) => waiting.push(resolve))
    },
    write: (text) => void input.write(text),
    transport(): Transport {
      const t: Transport = {
        start: async () => {
          listener = (m) => t.onmessage?.(m)
        },
        send: async (m) => void input.write(serializeMessage(m)),
        close: async () => {
          input.end()
          t.onclose?.()
        },
      }
      return t
    },
  }
}

export const request = (id: number, method: string, params: unknown = {}) =>
  `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
