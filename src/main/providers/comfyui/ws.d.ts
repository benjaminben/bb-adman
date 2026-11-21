// CU-9 (A-54): the part of the `ws` package (8.23.0) that live.ts uses. `@types/ws` is not
// installed, so only these names are typed; anything else of `ws` does not compile.
declare module 'ws' {
  import type { EventEmitter } from 'node:events'
  import type { Agent } from 'node:http'
  import type { LookupFunction } from 'node:net'

  export type ClientOptions = {
    agent: Agent
    lookup: LookupFunction
    rejectUnauthorized?: boolean
    maxPayload: number
    perMessageDeflate: false
    followRedirects: false
    handshakeTimeout: number
    headers: Record<string, string>
  }

  export default class WebSocket extends EventEmitter {
    constructor(address: string, options: ClientOptions)
    on(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this
    on(event: 'error', listener: () => void): this
    on(event: 'close', listener: () => void): this
    terminate(): void
  }
}
