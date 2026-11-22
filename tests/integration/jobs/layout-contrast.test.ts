// R2E-2 (spec/phases/round-2-editor.md D2): the layout_proposal job checks each placed text
// against the picture it drew, through the real core with the fake provider's layout and a
// stand-in readPixels. A reader that throws skips the check with one warn line.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createCore, type Core } from '@/main/core'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import type { JobRow } from '@/shared/schemas/rows/job'
import { fakeCrypto, data } from '../core-fixture'
import { seed, VARIANT, waitFor } from '../generation/generation-fixture'

const PICTURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])
const SECRET_COPY = 'Hello'

// A picture of one grey level, the size the job draws (longest side 1024 of 1080 by 1350).
function flat(level: number) {
  const width = 819
  const height = 1024
  return { width, height, rgba: new Uint8Array(width * height * 4).fill(level) }
}

let root = ''
let core: Core | null = null

afterEach(() => {
  core?.closeAll()
  fs.rmSync(root, { recursive: true, force: true })
})

async function runLayout(readPixels: CoreDeps['readPixels']) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-contrast-'))
  const read: Uint8Array[] = []
  core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: () => undefined,
    askPermission: async () => false,
    drawScene: async () => ({ png: PICTURE, overflow: {} }),
    readPixels: (png) => {
      read.push(png)
      return readPixels(png)
    },
  })
  const c = core
  const created = await c.bus.execute(
    'project.create',
    { name: 'P', location: root },
    {
      actor: 'user',
    },
  )
  const projectId = data<{ projectId: string }>(created).projectId
  const project = c.projects.requireOpen(projectId)
  seed(project.db)
  const started = await c.bus.execute(
    'generation.proposeLayout',
    { projectId, variantId: VARIANT, provider: 'fake' },
    { actor: 'user' },
  )
  const jobId = data<{ jobId: string }>(started).jobId
  const job = () => readWireRow(project.db, 'job', { id: jobId }) as JobRow
  await waitFor(() => job().status === 'succeeded' || job().status === 'failed')
  return { job: job(), read }
}

function logLines(): Array<Record<string, unknown>> {
  const dir = path.join(root, 'userData', 'logs')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .flatMap((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim().split('\n'))
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

const contrastLines = () => logLines().filter((l) => l.name === 'layout.contrast')

describe('layout_proposal keeps the text readable [D2]', () => {
  it('reads the picture it drew and changes white text on a white ground', async () => {
    const { job, read } = await runLayout(() => flat(255))
    expect(read).toEqual([PICTURE])
    expect(job.status).toBe('succeeded')
    const [box] = (job.result as { boxes: Array<Record<string, unknown>> }).boxes
    expect(box).toMatchObject({ slot: 'l-text', color: '#000000', readable: 'colour' })
    expect(contrastLines()).toEqual([])
  })

  it('keeps white text on a black ground', async () => {
    const { job } = await runLayout(() => flat(0))
    const [box] = (job.result as { boxes: Array<Record<string, unknown>> }).boxes
    expect(box).toMatchObject({ color: '#FFFFFF', readable: 'kept' })
  })

  it('gives the boxes as before, with no new keys, and one warn line when reading throws', async () => {
    const { job } = await runLayout(() => {
      throw new Error(`no pixels in ${root} for ${SECRET_COPY}`)
    })
    expect(job.status).toBe('succeeded')
    const boxes = (job.result as { boxes: Array<Record<string, unknown>> }).boxes
    expect(boxes).toHaveLength(1)
    expect(Object.keys(boxes[0] ?? {}).sort()).toEqual(
      ['align', 'color', 'fontSize', 'height', 'slot', 'typeStyle', 'width', 'x', 'y'].sort(),
    )
    expect(boxes[0]).toMatchObject({ color: '#FFFFFF' })
    const lines = contrastLines()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'warn',
      event: 'job',
      name: 'layout.contrast',
      errorKind: 'pixels_unreadable',
    })
    const text = JSON.stringify(lines[0])
    expect(text).not.toContain(root)
    expect(text).not.toContain(SECRET_COPY)
    expect(text).not.toContain('no pixels')
    expect(text).not.toContain('137,80,78')
  })
})
