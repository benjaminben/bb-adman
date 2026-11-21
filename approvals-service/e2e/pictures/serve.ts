import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

// spec/approvals-service-tests.md "Playwright set-up" (AP-4): the test picture server, Playwright's
// globalSetup. It serves the three pictures of this folder on 127.0.0.1 at the port
// playwright.config.ts chose; only the service fetches from it. It answers its own fixed names
// only, never a path from the request.
const PICTURES = ['a.png', 'b.png', 'c.jpg']

export default async function servePictures(): Promise<() => Promise<void>> {
  const port = Number(process.env.E2E_PICTURE_PORT)
  const files = new Map(
    PICTURES.map((name) => [`/${name}`, readFileSync(new URL(name, import.meta.url))]),
  )
  const server = createServer((request, reply) => {
    const bytes = files.get(request.url ?? '')
    if (bytes === undefined) return void reply.writeHead(404).end()
    reply.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(bytes)
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return () => new Promise<void>((resolve) => server.close(() => resolve()))
}
