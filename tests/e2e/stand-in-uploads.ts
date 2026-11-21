// What the app uploaded to the stand-in ComfyUI and the size it asked for (SPEC 14 1.60
// CU-6b-R N-11). Reads only the stand-in's own record of requests. Not a test file itself.
import type { StandIn } from '../helpers/comfy-stand-in'

export type Upload = { name: string; bytes: Uint8Array }

// Each POST /upload/image as the upload form builds it: the `image` part's file name and its
// bytes, which run from the end of the part's head to the next boundary.
export function uploads(stand: StandIn): Upload[] {
  return stand.seen
    .filter((r) => r.method === 'POST' && r.path === '/upload/image')
    .map((r) => {
      const body = r.body
      const boundary = body.subarray(0, body.indexOf('\r\n')).toString('latin1')
      const head = body.indexOf('Content-Type: image/png\r\n\r\n')
      const from = head + 'Content-Type: image/png\r\n\r\n'.length
      const to = body.indexOf(`\r\n${boundary}`, from)
      const name = /filename="([^"]+)"/.exec(body.subarray(0, from).toString('latin1'))?.[1] ?? ''
      return { name, bytes: new Uint8Array(body.subarray(from, to)) }
    })
}

// A PNG's stated size, from its IHDR chunk.
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

type Graph = Record<string, { inputs?: Record<string, unknown> }>

// The newest run's graph as the app sent it in POST /prompt.
export function lastGraph(stand: StandIn): Graph {
  const posts = stand.seen.filter((r) => r.method === 'POST' && r.path === '/prompt')
  const body = posts.at(-1)?.body.toString('utf8') ?? '{}'
  return ((JSON.parse(body) as { prompt?: Graph }).prompt ?? {}) as Graph
}

// The H3 graphs' node 5 holds the run's width and height (workflows/h3.ts TRIAL_SLOTS).
export function runSize(graph: Graph): { width: number; height: number } {
  const inputs = graph['5']?.inputs ?? {}
  return { width: Number(inputs.width), height: Number(inputs.height) }
}
