// Test harness for CU-4 through the real core: the slice H project (seed), the hand-test
// tools on or off, and a ComfyUI address saved with comfy.setAddress. Not a test file itself.
// It talks only to the stand-in server on 127.0.0.1; no key is saved, so no real provider can
// be reached.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createCore, type Core, type CoreOptions } from '@/main/core'
import type { BusEvent } from '@/main/commands/bus'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { greyPng } from '@/main/providers/fake/png'
import { webpInfo } from '@/main/providers/webp-size'
import { fakeCrypto, data } from '../core-fixture'
import { seed, VARIANT } from './generation-fixture'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { Actor } from '@/shared/schemas/events'

type FixtureOptions = {
  devTools: boolean
  origin?: string
  // [1.60] CU-6b: a stand-in for the picture fitter of CU-6b-F.
  fitPicture?: CoreOptions['fitPicture']
  // P10-3: a stand-in for the render window's draw.
  drawScene?: CoreOptions['drawScene']
  // P10-5: ADMAN_FAKE_PROVIDERS, so the AI tools can run on the fake provider.
  env?: Record<string, string>
  // S2-4: the model labels saved in settings.licenceConfirmed. By default every model that
  // needs a commercial licence, so tests of other rules are not refused by that check.
  licenceConfirmed?: string[]
}

const EVERY_LICENCE = ['MiniMax H3', 'FLUX 3 klein']

export async function makeComfyFixture(opts: FixtureOptions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-comfy-'))
  const events: BusEvent[] = []
  const core: Core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: opts.env ?? {},
    devTools: opts.devTools,
    emit: (e) => events.push(e),
    askPermission: async () => false,
    toPng: (bytes) => bytes,
    // Slice WP: a stand-in for the decoder window, a grey PNG of the WebP's own size.
    webpToPng: async (bytes) => {
      const { width, height } = webpInfo(bytes)
      return greyPng(width, height)
    },
    ...(opts.fitPicture && { fitPicture: opts.fitPicture }),
    ...(opts.drawScene && { drawScene: opts.drawScene }),
  })
  const as = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    core.bus.execute(name, { projectId, ...input }, { actor })
  const created = await core.bus.execute(
    'project.create',
    { name: 'P', location: root },
    { actor: 'user' },
  )
  const projectId = data<{ projectId: string }>(created).projectId
  const project = core.projects.requireOpen(projectId)
  seed(project.db)
  const licenceConfirmed = opts.licenceConfirmed ?? EVERY_LICENCE
  data(await core.bus.execute('settings.update', { licenceConfirmed }, { actor: 'user' }))
  if (opts.origin) {
    data(await core.bus.execute('comfy.setAddress', { address: opts.origin }, { actor: 'user' }))
  }
  const user = as('user')

  return {
    core,
    root,
    events,
    projectId,
    project,
    db: project.db,
    user,
    agent: as('agent'),
    run: (input: Record<string, unknown>, actor: Actor = 'user') =>
      as(actor)('generation.runImages', {
        variantId: VARIANT,
        slot: 'background',
        prompt: 'A bottle on a rock',
        referenceAssetIds: [],
        count: 1,
        provider: 'comfyui',
        ...input,
      }),
    // Imports a picture by link from `folder/name` under the root, and gives its asset ID.
    async importPicture(folder: string, name: string, bytes: Uint8Array = greyPng(6, 4)) {
      const dir = path.join(root, folder)
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, name)
      fs.writeFileSync(file, bytes)
      const r = await user('asset.import', { paths: [file], library: 'reference', copy: false })
      const [id] = data<{ assetIds: string[] }>(r).assetIds
      if (!id) throw new Error('import gave no asset')
      return id
    },
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    jobs: () => readWireRows(project.db, 'job') as JobRow[],
    asset: (id: string) => readWireRow(project.db, 'asset', { id }) as AssetRow | null,
    projectFile: () => project.filePath,
    cleanup() {
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

export type ComfyFixture = Awaited<ReturnType<typeof makeComfyFixture>>
