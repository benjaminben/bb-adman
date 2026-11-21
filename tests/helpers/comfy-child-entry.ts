// CU-2b: run by plain Node in a child process (tests/helpers/comfy-child.ts), so the process
// starts with the proxy variables set. Node strips the types; the hook below finds `@/` and
// extensionless imports the way the bundler does. Prints one JSON line on stdout.
//   node comfy-child-entry.ts <src folder> client <origin>  every client call, once
//   node comfy-child-entry.ts <src folder> global <url>     one GET with Node's global agent
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [src = '', mode = '', target = ''] = process.argv.slice(2)

function sourceFile(base: string): string | undefined {
  const tries = [`${base}.ts`, path.join(base, 'index.ts'), base]
  return tries.find((f) => f.endsWith('.ts') && fs.existsSync(f) && fs.statSync(f).isFile())
}

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL ?? ''
    let base: string | undefined
    if (specifier.startsWith('@/')) base = path.join(src, specifier.slice(2))
    else if (specifier.startsWith('.') && parent.endsWith('.ts')) {
      base = path.resolve(path.dirname(fileURLToPath(parent)), specifier)
    }
    const file = base === undefined ? undefined : sourceFile(base)
    if (file === undefined) return next(specifier, context)
    return { url: pathToFileURL(file).href, format: 'module-typescript', shortCircuit: true }
  },
})

type Outcome = { name: string; ok: boolean; reason?: string }

async function clientCalls(origin: string): Promise<Outcome[]> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const load = (file: string) => import(pathToFileURL(file).href)
  const { createComfyClient } = await load(path.join(src, 'main/providers/comfyui/client.ts'))
  const { everyCall } = await load(path.join(here, 'comfy-every-call.ts'))
  const client = createComfyClient({ origin, ownPorts: () => [] })
  const outcomes: Outcome[] = []
  for (const [name, run] of everyCall(client) as Array<[string, () => Promise<unknown>]>) {
    try {
      await run()
      outcomes.push({ name, ok: true })
    } catch (error) {
      const reason = (error as { error?: { reason?: string } }).error?.reason ?? 'none'
      outcomes.push({ name, ok: false, reason })
    }
  }
  return outcomes
}

function globalGet(url: string): Promise<number | string> {
  const get = url.startsWith('https:') ? https.get : http.get
  return new Promise((done) => {
    get(url, (res) => {
      res.resume()
      done(res.statusCode ?? 0)
    }).on('error', (error: NodeJS.ErrnoException) => done(error.code ?? 'error'))
  })
}

const result = mode === 'client' ? await clientCalls(target) : await globalGet(target)
process.stdout.write(`${JSON.stringify(result)}\n`)
