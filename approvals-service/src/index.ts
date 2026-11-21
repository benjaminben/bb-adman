// The Worker's entry: builds the app from its environment and hands over the request.
import { createApp } from './app'
import { cryptoBytes } from './crypto/random'
import type { Env } from './env'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createApp(env, { now: () => Date.now(), random: cryptoBytes }).fetch(request)
  },
}
