// P9-12 (approved main-process edit, A-260): the consent is bound to the font the user was
// shown. publish.inspect gives each font the SHA-256 it measured; publish.setFontConsent takes
// it back as `sha256` and refuses when the bytes it measures now are not the ones shown.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { FONT_CONSENT_FILE } from '@/main/publish/font-consent'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import { data } from '../core-fixture'
import { BYTES } from './component-project'
import { id, inspectSetUp, type InspectSetUp } from './inspect-setup'

const FONT = id(1)
const GONE = id(2)
const PICTURE = id(3)

let s: InspectSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

const files: Record<string, string> = {}
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')

async function setUp(): Promise<InspectSetUp> {
  return inspectSetUp((p) => {
    files[FONT] = p.asset({ id: FONT, file: 'a.ttf', bytes: BYTES.ttf, kind: 'font' })
    files[GONE] = p.asset({ id: GONE, file: 'b.ttf', bytes: BYTES.ttf, kind: 'font' })
    p.asset({ id: PICTURE, file: 'd.png' })
    p.layer('vaaaaa', { font: FONT })
    p.layer('vaaaaa', { font: GONE })
    p.layer('vaaaaa', { image: PICTURE })
  })
}

async function hashes(x: InspectSetUp): Promise<Record<string, string | null>> {
  const reply = data<PublishInspect>(await x.inspect({ storage: null }))
  return Object.fromEntries(reply.components.map((c) => [c.assetId, c.sha256]))
}

const consent = (x: InspectSetUp, extra: object) =>
  x.fx.user('publish.setFontConsent', { projectId: x.projectId, assetId: FONT, ...extra })

const consentFile = (x: InspectSetUp) => path.join(x.fx.userData, FONT_CONSENT_FILE)

describe('publish.inspect gives each font the hash it measured [P9-12, A-260]', () => {
  it('gives a usable font the SHA-256 of its bytes, and null to a missing font and a picture', async () => {
    s = await setUp()
    fs.rmSync(files[GONE] as string)
    expect(await hashes(s)).toEqual({ [FONT]: sha(BYTES.ttf), [GONE]: null, [PICTURE]: null })
  })

  it('gives the new hash after the font file changes', async () => {
    s = await setUp()
    const changed = Buffer.concat([BYTES.ttf, Buffer.from([9])])
    fs.writeFileSync(files[FONT] as string, changed)
    expect((await hashes(s))[FONT]).toBe(sha(changed))
  })
})

describe('publish.setFontConsent with the hash shown [P9-12, A-260, security]', () => {
  it('gives consent when the hash shown is the hash of the bytes now', async () => {
    s = await setUp()
    const shown = (await hashes(s))[FONT]
    expect((await consent(s, { allowed: true, sha256: shown })).ok).toBe(true)
    const reply = data<PublishInspect>(await s.inspect({ storage: null }))
    expect(reply.components.find((c) => c.assetId === FONT)?.share).toBe('confirmed')
  })

  it('refuses, writing nothing, when the font changed after it was shown', async () => {
    s = await setUp()
    const shown = (await hashes(s))[FONT]
    fs.writeFileSync(files[FONT] as string, Buffer.concat([BYTES.ttf, Buffer.from([9])]))
    expect(await consent(s, { allowed: true, sha256: shown })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'The font file cannot be found or is not a usable font.',
        details: { reason: 'font_file_unusable' },
      },
    })
    expect(fs.existsSync(consentFile(s))).toBe(false)
  })

  it.each([
    ['upper-case hex', 'A'.repeat(64)],
    ['too short', 'a'.repeat(63)],
    ['not hex', 'g'.repeat(64)],
  ])('refuses a hash that is %s as INVALID_INPUT', async (_name, sha256) => {
    s = await setUp()
    const reply = await consent(s, { allowed: true, sha256 })
    expect(reply).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(fs.existsSync(consentFile(s))).toBe(false)
  })

  it('takes consent back whatever hash is sent', async () => {
    s = await setUp()
    await consent(s, { allowed: true })
    expect((await consent(s, { allowed: false, sha256: 'b'.repeat(64) })).ok).toBe(true)
    const reply = data<PublishInspect>(await s.inspect({ storage: null }))
    expect(reply.components.find((c) => c.assetId === FONT)?.share).toBe('not_shared')
  })
})
