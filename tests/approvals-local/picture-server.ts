// The test picture server of the local proof (AP-13): serves the app's test picture folder
// ({userData}/approvals-test-pictures/) on 127.0.0.1, GET only. Only the service fetches from it
// (TEST_PICTURE_ORIGIN). The address is taken only when every part is a plain name (letters,
// digits, `.`, `_`, `-`; no `.` or `..` part, no backslash, no `%`, no query) and it names a
// `.png` or `.mp4`
// file; a path that still leaves the folder (by real path), a link or anything but a file gets
// 404. A clip answers `Range` as the service's test server does (R2V-8, as R2V-2's
// approvals-service/e2e/pictures/serve.ts): `bytes=a-b` or `bytes=a-` gets 206 with an exact
// Content-Range, a piece outside the file 416, any other Range or none the whole file.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const PART = /^[A-Za-z0-9._-]+$/
const KINDS: Record<string, string> = { '.png': 'image/png', '.mp4': 'video/mp4' }
const RANGE = /^bytes=(\d+)-(\d*)$/

function partsOf(url: string | undefined): string[] | null {
  const pathname = url?.startsWith('/') === true ? url : null
  if (pathname === null) return null
  const parts = pathname.slice(1).split('/')
  const plain = parts.every((p) => PART.test(p) && p !== '.' && p !== '..')
  return plain ? parts : null
}

function fileOf(root: string, url: string | undefined): string | null {
  const parts = partsOf(url)
  if (parts === null || KINDS[path.extname(parts.at(-1) ?? '')] === undefined) return null
  const file = path.resolve(root, ...parts)
  if (!file.startsWith(root + path.sep)) return null
  try {
    const stats = fs.lstatSync(file, { throwIfNoEntry: false })
    if (stats?.isFile() !== true) return null
    // A link to a folder inside the root is not followed out of it.
    const realRoot = fs.realpathSync(root)
    return fs.realpathSync(file).startsWith(realRoot + path.sep) ? file : null
  } catch {
    return null
  }
}

function sendClip(bytes: Buffer, range: string | undefined, reply: http.ServerResponse): void {
  const match = RANGE.exec(range ?? '')
  const type = KINDS['.mp4']
  if (match === null) {
    reply.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.byteLength })
    return void reply.end(bytes)
  }
  const start = Number(match[1])
  const end = Math.min(match[2] === '' ? bytes.length - 1 : Number(match[2]), bytes.length - 1)
  if (start >= bytes.length || end < start) {
    reply.writeHead(416, { 'Content-Range': `bytes */${bytes.length}`, 'Content-Length': 0 })
    return void reply.end()
  }
  reply.writeHead(206, {
    'Content-Type': type,
    'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
    'Content-Length': end - start + 1,
  })
  reply.end(bytes.subarray(start, end + 1))
}

export async function servePictures(root: string, port: number): Promise<() => Promise<void>> {
  const server = http.createServer((request, reply) => {
    const file = request.method === 'GET' ? fileOf(root, request.url) : null
    if (file === null) return void reply.writeHead(404, { 'Content-Length': 0 }).end()
    const bytes = fs.readFileSync(file)
    if (path.extname(file) === '.mp4') return sendClip(bytes, request.headers.range, reply)
    reply.writeHead(200, { 'Content-Type': KINDS['.png'], 'Content-Length': bytes.byteLength })
    reply.end(bytes)
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    })
}
