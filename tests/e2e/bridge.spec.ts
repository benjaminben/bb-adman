// P10-9 (spec/mcp-and-agents.md, "Bridge mode"; A-244): the built app started with
// --mcp-bridge, as Claude Desktop starts it, speaks MCP on stdio. It opens no window: Chromium's
// own debugging list, which the test turns on, shows no page. The process is ended in every
// case. Token checks compare with a boolean, so a failure never prints it.
import { test, expect, type ElectronApplication } from '@playwright/test'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makeSandbox, launch, quietEnv, type Sandbox } from './launch'
import { command, query } from './render-helpers'
import { freePort } from '../integration/mcp/http-client'

const electronBin = createRequire(import.meta.url)('electron') as unknown as string
const CLOSED = 'Open the app and turn on agent access in Settings.'
const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'made-up-desktop', version: '0.0.0' },
  },
}

type Bridge = {
  child: ChildProcessWithoutNullStreams
  stdout: () => string
  stderr: () => string
  send: (m: unknown) => void
  next: () => Promise<Record<string, unknown>>
  debugPort: Promise<number>
}

let box: Sandbox | undefined
let app: ElectronApplication | undefined
let bridge: Bridge | undefined

test.afterEach(async () => {
  if (bridge && bridge.child.exitCode === null) bridge.child.kill('SIGKILL')
  bridge = undefined
  await app?.close()
  app = undefined
  if (box) fs.rmSync(box.root, { recursive: true, force: true })
  box = undefined
})

function startBridge(userData: string): Bridge {
  const child = spawn(
    electronBin,
    ['.', '--use-mock-keychain', '--remote-debugging-port=0', '--mcp-bridge'],
    { env: { ...process.env, ADMAN_USER_DATA_DIR: userData, ...quietEnv(process.env) } },
  )
  let out = ''
  let err = ''
  const waiting: Array<() => void> = []
  child.stdout.on('data', (c: Buffer) => {
    out += c.toString('utf8')
    waiting.splice(0).forEach((w) => w())
  })
  const debugPort = new Promise<number>((resolve) =>
    child.stderr.on('data', (c: Buffer) => {
      err += c.toString('utf8')
      const found = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(err)
      if (found) resolve(Number(found[1]))
    }),
  )
  let read = 0
  async function next(): Promise<Record<string, unknown>> {
    for (;;) {
      const end = out.indexOf('\n', read)
      if (end >= 0) {
        const line = out.slice(read, end)
        read = end + 1
        return JSON.parse(line) as Record<string, unknown>
      }
      await new Promise<void>((resolve) => waiting.push(resolve))
    }
  }
  const send = (m: unknown) => void child.stdin.write(`${JSON.stringify(m)}\n`)
  return { child, stdout: () => out, stderr: () => err, send, next, debugPort }
}

// Chromium's list of pages: every window and web view the process has.
async function pages(b: Bridge): Promise<unknown[]> {
  const port = await b.debugPort
  const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as unknown[]
  return list.filter((t) => (t as { type?: string }).type === 'page')
}

function exited(b: Bridge): Promise<number | null> {
  if (b.child.exitCode !== null) return Promise.resolve(b.child.exitCode)
  return new Promise((resolve) => b.child.once('exit', (code) => resolve(code)))
}

test('with agent access off, the bridge opens no window and answers initialize with the closed answer', async () => {
  box = makeSandbox()
  bridge = startBridge(box.userData)
  bridge.send(INIT)
  expect(await bridge.next()).toEqual({
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32000, message: CLOSED },
  })
  expect(await pages(bridge)).toEqual([])
  bridge.child.stdin.end()
  expect(await exited(bridge)).toBe(0)
})

test('with agent access on in the running app, the bridge relays to it and lists its tools', async () => {
  box = makeSandbox()
  app = await launch(box)
  const page = await app.firstWindow()
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const saved = (name: string) => fs.readFileSync(path.join(box!.userData, name))
  const before = { settings: saved('settings.json'), secrets: saved('secrets.bin') }

  bridge = startBridge(box.userData)
  bridge.send(INIT)
  const init = await bridge.next()
  expect(init).toMatchObject({ id: 1, result: { serverInfo: expect.any(Object) } })
  bridge.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  bridge.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const listed = (await bridge.next()) as { id: number; result: { tools: { name: string }[] } }
  expect(listed.id).toBe(2)
  expect(listed.result.tools.map((t) => t.name)).toContain('list_projects')
  expect(await pages(bridge)).toEqual([])
  bridge.child.stdin.end()
  expect(await exited(bridge)).toBe(0)
  expect(bridge.stdout().includes(token)).toBe(false)
  expect(bridge.stderr().includes(token)).toBe(false)
  // The bridge changed neither file it read.
  expect(saved('settings.json').equals(before.settings)).toBe(true)
  expect(saved('secrets.bin').equals(before.secrets)).toBe(true)
})

// Every name in a folder, recursively, as paths relative to it.
function listing(folder: string): string[] {
  return (fs.readdirSync(folder, { recursive: true }) as string[]).sort()
}

const bridgeSessionFolders = () =>
  fs.readdirSync(fs.realpathSync(os.tmpdir())).filter((n) => n.startsWith('adman-bridge-'))

// Review fix (spec/mcp-and-agents.md "Bridge mode", owed hardening): Chromium's own files go to
// a temporary folder. The bridge runs on a data folder holding only the app's settings.json and
// secrets.bin, copied from the running app's. It still decrypts the token (the tools are
// listed), and afterwards the folder holds the same names and both files the same bytes.
test('the bridge leaves the data folder as it found it and removes its session folder', async () => {
  box = makeSandbox()
  app = await launch(box)
  const page = await app.firstWindow()
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const own = path.join(box.root, 'bridge-data')
  fs.mkdirSync(own)
  for (const name of ['settings.json', 'secrets.bin'])
    fs.copyFileSync(path.join(box.userData, name), path.join(own, name))
  const saved = (name: string) => fs.readFileSync(path.join(own, name))
  const before = {
    names: listing(own),
    settings: saved('settings.json'),
    secrets: saved('secrets.bin'),
  }
  const sessionsBefore = bridgeSessionFolders()

  bridge = startBridge(own)
  bridge.send(INIT)
  expect(await bridge.next()).toMatchObject({ id: 1, result: { serverInfo: expect.any(Object) } })
  bridge.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  bridge.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const listed = (await bridge.next()) as { result: { tools: { name: string }[] } }
  expect(listed.result.tools.map((t) => t.name)).toContain('list_projects')
  bridge.child.stdin.end()
  expect(await exited(bridge)).toBe(0)

  expect(listing(own)).toEqual(before.names)
  expect(saved('settings.json').equals(before.settings)).toBe(true)
  expect(saved('secrets.bin').equals(before.secrets)).toBe(true)
  expect(bridgeSessionFolders()).toEqual(sessionsBefore)
})
