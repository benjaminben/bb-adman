import { readFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'

// spec/approvals-service-tests.md "Playwright set-up" (AP-4): the test picture server, Playwright's
// globalSetup. It serves the pictures and the test clip of this folder on 127.0.0.1 at the port
// playwright.config.ts chose; only the service fetches from it. It answers its own fixed names
// only, never a path from the request.
const FILES = ['a.png', 'b.png', 'c.jpg', 'd.mp4']
const CLIP = '/d.mp4'
const RANGE = /^bytes=(\d+)-(\d*)$/

// round-2-approvals-video.md R2V-2: the clip answers `bytes=a-b` and `bytes=a-` as S3 does, with
// a 206 and an exact Content-Range; any other Range, or none, gets the whole file.
function sendClip(bytes: Buffer, range: string | undefined, reply: ServerResponse) {
  const match = RANGE.exec(range ?? '')
  if (match === null) return void reply.writeHead(200, { 'Content-Type': 'video/mp4' }).end(bytes)
  const start = Number(match[1])
  const end = Math.min(match[2] === '' ? bytes.length - 1 : Number(match[2]), bytes.length - 1)
  if (start >= bytes.length || end < start) {
    return void reply.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }).end()
  }
  reply
    .writeHead(206, {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
      'Content-Length': String(end - start + 1),
    })
    .end(bytes.subarray(start, end + 1))
}

export default async function servePictures(): Promise<() => Promise<void>> {
  const port = Number(process.env.E2E_PICTURE_PORT)
  const files = new Map(
    FILES.map((name) => [`/${name}`, readFileSync(new URL(name, import.meta.url))]),
  )
  const server = createServer((request, reply) => {
    const path = request.url ?? ''
    const bytes = files.get(path)
    if (bytes === undefined) return void reply.writeHead(404).end()
    if (path === CLIP) return sendClip(bytes, request.headers.range, reply)
    reply.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(bytes)
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => server.close(() => resolve()))
}
