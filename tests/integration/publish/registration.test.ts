// P9-1 (spec/phases/phase-09-slices.md, "P9-1 — Contracts"): every Phase 9 command, query, job
// kind and port is registered against a stub. A stub checks its input, then refuses before it
// reads or writes anything. The agent rows are final now. Each later slice removes exactly its
// own rows from the tables below when it fills its stub.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, fakeCrypto, type Fixture } from '../core-fixture'
import { createCore } from '@/main/core'
import { publishCommands } from '@/main/commands/publish'
import { storageCommands } from '@/main/commands/storage'
import { publishQueries } from '@/main/queries/publish'
import { jobKindHandlers } from '@/main/jobs/kinds'
import { publishKind } from '@/main/jobs/kinds/publish'
import { LocalFailure } from '@/main/jobs/local-failure'
import { createPublishDeps } from '@/main/publish/deps'
import { defaultDropboxFetch } from '@/main/providers/dropbox/fetch'
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'
import { PUBLISH_INSPECT_DENIED } from '@/shared/publish/messages'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function open(env: Record<string, string> = {}) {
  const fx = makeFixture({ env })
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

describe('Phase 9 registration [P9-1]', () => {
  it('registers the publish and Dropbox commands and publish.inspect on core', async () => {
    const { fx } = await open()
    const deps = fx.core.deps
    expect(publishCommands(deps).map((h) => h.name)).toEqual([
      'publish.run',
      'publish.setFontConsent',
    ])
    expect(storageCommands(deps).map((h) => h.name)).toEqual([
      'storage.checkS3',
      'storage.dropboxSignIn',
      'storage.dropboxSignOut',
      'storage.setDropboxFolder',
    ])
    expect(Object.keys(publishQueries(deps))).toEqual(['publish.inspect'])
    expect(fx.core.commandNames).toContain('publish.run')
    expect(fx.core.queryNames).toContain('publish.inspect')
  })

  it('has one handler for the publish job kind', () => {
    expect(jobKindHandlers.filter((h) => h.kind === 'publish')).toHaveLength(1)
  })

  it('keeps the Dropbox app key on record (D-007), a public identifier', () => {
    expect(DROPBOX_APP_KEY).toBe('sxcjvdik8esx6mx')
  })
})

describe('the publish.inspect stub [P9-1]', () => {
  const input = (projectId: string) => ({ projectId, campaignId: 'C1', storage: null })

  it('refuses the agent before it reads the input', async () => {
    const { fx, projectId } = await open()
    const denied = { ok: false, error: { code: 'AGENT_DENIED', message: PUBLISH_INSPECT_DENIED } }
    expect(PUBLISH_INSPECT_DENIED).toBe(
      'Agents cannot read publish details in this version. Ask the user to do it in the app.',
    )
    const asAgent = { actor: 'agent' as const }
    expect(await fx.core.query('publish.inspect', input(projectId), asAgent)).toEqual(denied)
    expect(await fx.core.query('publish.inspect', { extra: 1 }, asAgent)).toEqual(denied)
  })
})

describe('the Phase 9 job kind and port stubs [P9-1]', () => {
  const exportNotBuilt = { reason: 'export_not_built' }

  it('fails a publish job with the local reason export_not_built', async () => {
    const job = publishKind().run({} as never, {} as never)
    await expect(job).rejects.toBeInstanceOf(LocalFailure)
    await expect(job).rejects.toMatchObject(exportNotBuilt)
  })

  it('refuses both export ports with export_not_built', async () => {
    const { fx } = await open()
    const ports = createPublishDeps()
    const exported = ports.exportForPublish(fx.core.deps, {} as never)
    await expect(exported).rejects.toBeInstanceOf(LocalFailure)
    await expect(exported).rejects.toMatchObject(exportNotBuilt)
    const warnings = ports.warningsForPublish(fx.core.deps, { projectId: 'P', campaignId: 'C1' })
    await expect(warnings).rejects.toMatchObject(exportNotBuilt)
  })

  it('puts the publish ports and the Dropbox fetch on CoreDeps', async () => {
    const { fx } = await open()
    expect(Object.keys(fx.core.deps.publish).sort()).toEqual(
      ['exportForPublish', 'storageFor', 'warningsForPublish'].sort(),
    )
    expect(fx.core.deps.dropboxFetch).toBe(defaultDropboxFetch)
  })

  it('takes the Dropbox fetch from the core options when one is given', () => {
    const { root } = makeFixture()
    const own: typeof fetch = () => Promise.reject(new Error('stand-in only'))
    const core = createCore({
      userDataDir: path.join(root, 'userData'),
      documentsDir: path.join(root, 'Documents'),
      appVersion: '0.1.0',
      crypto: fakeCrypto(),
      env: {},
      emit: () => undefined,
      dropboxFetch: own,
    })
    expect(core.deps.dropboxFetch).toBe(own)
    core.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('storageFor [P9-1, A-228]', () => {
  it('gives the fake storage in {userData}/fake-storage when the fake provider is listed', async () => {
    const { fx } = await open({ ADMAN_FAKE_PROVIDERS: '1' })
    const storage = fx.core.deps.publish.storageFor(fx.core.deps, 'fake')
    await storage.write('C1/hello.txt', new TextEncoder().encode('hi'), 'text/plain')
    const written = path.join(fx.userData, 'fake-storage', 'C1', 'hello.txt')
    expect(fs.readFileSync(written, 'utf8')).toBe('hi')
    expect(await storage.list('C1/')).toEqual(['C1/hello.txt'])
  })

  it('refuses the fake storage when the fake provider is not listed', async () => {
    const { fx } = await open()
    expect(() => fx.core.deps.publish.storageFor(fx.core.deps, 'fake')).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    )
    expect(fs.existsSync(path.join(fx.userData, 'fake-storage'))).toBe(false)
  })

  it('gives the S3 adapter through adapterFor, with no call made', async () => {
    const { fx } = await open()
    const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
    await fx.user('settings.update', { storage: { s3 } })
    await fx.user('secret.set', { name: 's3.accessKeyId', value: 'MADEUPACCESSID0000' })
    await fx.user('secret.set', { name: 's3.secretAccessKey', value: 'made-up-secret-0000' })
    const storage = fx.core.deps.publish.storageFor(fx.core.deps, 's3')
    for (const method of ['exists', 'read', 'write', 'list', 'remove'] as const) {
      expect(typeof storage[method]).toBe('function')
    }
  })
})
