// The test picture server of the local proof (AP-13): serves the app's test picture folder
// ({userData}/approvals-test-pictures/) on 127.0.0.1, GET only. Only the service fetches from it
// (TEST_PICTURE_ORIGIN). A path that leaves the folder, a link or anything but a file gets 404.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

function fileOf(root: string, url: string | undefined): string | null {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(url ?? '/', 'http://127.0.0.1').pathname)
  } catch {
    return null
  }
  const file = path.resolve(root, `.${pathname}`)
  if (!file.startsWith(root + path.sep)) return null
  const stats = fs.lstatSync(file, { throwIfNoEntry: false })
  return stats?.isFile() === true ? file : null
}

export async function servePictures(root: string, port: number): Promise<() => Promise<void>> {
  const server = http.createServer((request, reply) => {
    const file = request.method === 'GET' ? fileOf(root, request.url) : null
    if (file === null) return void reply.writeHead(404, { 'Content-Length': 0 }).end()
    const bytes = fs.readFileSync(file)
    reply.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.byteLength })
    reply.end(bytes)
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    })
}
