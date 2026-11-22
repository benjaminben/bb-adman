// AP-13, the local proof's set-up (spec/phases/approvals-desktop-slices.md, "AP-13"): a temporary
// folder; the service's migration into a local database file there; `next build`; `next start`
// on 127.0.0.1 with a key made for this run; the test picture server for the app's test picture
// folder; then the wait for the health route. Nothing here contacts anything off this machine.
// The key lives only in the service's environment and the workers' (for the app's test
// settings); it is never printed or written to a file.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { servePictures } from './picture-server'

const SERVICE = path.resolve('approvals-service')
const HEALTH_WAIT_MS = 120_000

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

// The parent's environment without any value of ours, so no key reaches migrate or build.
function baseEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
  const names = [
    'API_KEY',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'VERCEL',
    'APPROVALS_LOCAL_KEY',
  ]
  for (const name of names) {
    delete env[name]
  }
  return env
}

function run(script: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync('npm', ['run', script], { cwd: SERVICE, env, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`approvals-service: npm run ${script} failed`)
}

async function waitForHealth(origin: string, key: string, server: ChildProcess): Promise<void> {
  const headers = { Authorization: `Bearer ${key}` }
  const end = Date.now() + HEALTH_WAIT_MS
  while (Date.now() < end) {
    if (server.exitCode !== null) throw new Error('approvals-service: next start stopped')
    const reply = await fetch(`${origin}/api/v1/health`, { headers }).catch(() => null)
    if (reply?.status === 200) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('approvals-service: the health route did not answer')
}

function stop(server: ChildProcess): void {
  if (server.pid === undefined || server.exitCode !== null) return
  try {
    // The whole group: npm and the next process it started.
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill('SIGTERM')
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-approvals-local-'))
  const userData = path.join(folder, 'userData')
  const pictures = path.join(userData, 'approvals-test-pictures')
  fs.mkdirSync(pictures, { recursive: true })
  // The first-run setup is marked done, as tests/e2e/launch.ts does.
  const defaults = { defaultProjectDir: path.join(folder, 'projects'), setup: { done: true } }
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(defaults))

  const key = randomBytes(36).toString('base64url')
  const port = await freePort()
  const picturePort = await freePort()
  const database = `file:${path.join(folder, 'local.db')}`

  let server: ChildProcess | undefined
  let closePictures: (() => Promise<void>) | undefined
  const teardown = async () => {
    if (server !== undefined) stop(server)
    await closePictures?.()
    fs.rmSync(folder, { recursive: true, force: true })
  }
  try {
    run('db:migrate', { ...baseEnv(), TURSO_DATABASE_URL: database })
    run('build', baseEnv())
    closePictures = await servePictures(pictures, picturePort)
    server = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
      cwd: SERVICE,
      detached: true,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...baseEnv(),
        API_KEY: key,
        TURSO_DATABASE_URL: database,
        TEST_PICTURE_ORIGIN: `http://127.0.0.1:${picturePort}`,
      },
    })
    await waitForHealth(`http://127.0.0.1:${port}`, key, server)
  } catch (error) {
    await teardown()
    throw error
  }
  process.env.APPROVALS_LOCAL_FOLDER = folder
  process.env.APPROVALS_LOCAL_PORT = String(port)
  process.env.APPROVALS_LOCAL_PICTURE_PORT = String(picturePort)
  process.env.APPROVALS_LOCAL_KEY = key
  return teardown
}
