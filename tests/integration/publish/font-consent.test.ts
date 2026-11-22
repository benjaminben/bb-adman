// P9-9 (spec/phases/phase-09.md "Font sharing consent is local", A-260, security class full): a
// project file can come from someone else, so its "may share this font" flag alone never makes a
// font `confirmed`. Only this machine's consent list does, keyed by project ID, asset ID and the
// hash of the font file's bytes as measured now.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { denialMessage } from '@/main/commands/agent-policy'
import { FONT_CONSENT_FILE, fontConsent } from '@/main/publish/font-consent'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import { data } from '../core-fixture'
import { BYTES } from './component-project'
import { id, inspectSetUp, type InspectSetUp } from './inspect-setup'

const FONT = id(1)
const TWIN = id(2)
const UNFLAGGED = id(3)
const PICTURE = id(4)

let s: InspectSetUp | undefined
const others: InspectSetUp[] = []
afterEach(() => {
  s?.cleanup()
  s = undefined
  for (const o of others.splice(0)) o.cleanup()
})

const files: Record<string, string> = {}

async function setUp(): Promise<InspectSetUp> {
  return inspectSetUp((p) => {
    files[FONT] = p.asset({
      id: FONT,
      file: 'a.ttf',
      bytes: BYTES.ttf,
      kind: 'font',
      fontPublishAllowed: true,
    })
    files[TWIN] = p.asset({
      id: TWIN,
      file: 'b.ttf',
      bytes: BYTES.ttf,
      kind: 'font',
      fontPublishAllowed: true,
    })
    p.asset({ id: UNFLAGGED, file: 'c.ttf', bytes: BYTES.ttf, kind: 'font' })
    p.asset({ id: PICTURE, file: 'd.png' })
    p.layer('vaaaaa', { font: FONT })
    p.layer('vaaaaa', { font: TWIN })
    p.layer('vaaaaa', { font: UNFLAGGED })
    p.layer('vaaaaa', { image: PICTURE })
  })
}

async function shares(x: InspectSetUp): Promise<Record<string, string | null>> {
  const reply = data<PublishInspect>(await x.inspect({ storage: null }))
  return Object.fromEntries(reply.components.map((c) => [c.assetId, c.share]))
}

const consent = (x: InspectSetUp, assetId: string, allowed = true) =>
  x.fx.user('publish.setFontConsent', { projectId: x.projectId, assetId, allowed })

const consentFile = (x: InspectSetUp) => path.join(x.fx.userData, FONT_CONSENT_FILE)

describe('font share from the local consent list [P9-9, A-260]', () => {
  it('gives needs_confirming for a flag of 1 with no local consent, not_shared without the flag', async () => {
    s = await setUp()
    expect(await shares(s)).toEqual({
      [FONT]: 'needs_confirming',
      [TWIN]: 'needs_confirming',
      [UNFLAGGED]: 'not_shared',
      [PICTURE]: null,
    })
  })

  it('gives confirmed after publish.setFontConsent, for that font only', async () => {
    s = await setUp()
    expect((await consent(s, FONT)).ok).toBe(true)
    expect(await shares(s)).toMatchObject({ [FONT]: 'confirmed', [TWIN]: 'needs_confirming' })
    expect((await consent(s, UNFLAGGED)).ok).toBe(true)
    expect((await shares(s))[UNFLAGGED]).toBe('confirmed')
  })

  it('takes the consent back with allowed false', async () => {
    s = await setUp()
    await consent(s, FONT)
    expect((await consent(s, FONT, false)).ok).toBe(true)
    expect((await shares(s))[FONT]).toBe('needs_confirming')
  })

  it('gives needs_confirming again when the font file changes', async () => {
    s = await setUp()
    await consent(s, FONT)
    fs.writeFileSync(files[FONT] as string, Buffer.concat([BYTES.ttf, Buffer.from([1, 2, 3])]))
    expect((await shares(s))[FONT]).toBe('needs_confirming')
  })

  it('keys the consent by the hash of the bytes, never the hash the project file stores', async () => {
    s = await setUp()
    await consent(s, FONT)
    const saved = JSON.parse(fs.readFileSync(consentFile(s), 'utf8')) as {
      format: number
      keys: string[]
    }
    expect(saved.format).toBe(1)
    expect(saved.keys).toHaveLength(1)
    expect(saved.keys[0]).toMatch(new RegExp(`^${s.projectId}:${FONT}:[0-9a-f]{64}$`))
    expect(saved.keys[0]).not.toContain(':h')
  })

  it('does not confirm another project with the same asset ID and the same bytes', async () => {
    s = await setUp()
    await consent(s, FONT)
    const other = await setUp()
    others.push(other)
    expect(other.projectId).not.toBe(s.projectId)
    fs.copyFileSync(consentFile(s), consentFile(other))
    expect((await shares(other))[FONT]).toBe('needs_confirming')
    expect((await shares(s))[FONT]).toBe('confirmed')
  })

  it('answers hasConsent only for a well-formed key that is in the list', async () => {
    s = await setUp()
    await consent(s, FONT)
    const list = fontConsent(s.fx.core.deps)
    const [key] = (JSON.parse(fs.readFileSync(consentFile(s), 'utf8')) as { keys: string[] }).keys
    const sha = (key as string).split(':')[2] as string
    expect(list.hasConsent(s.projectId, FONT, sha)).toBe(true)
    expect(list.hasConsent(s.projectId, TWIN, sha)).toBe(false)
    expect(list.hasConsent(id(77), FONT, sha)).toBe(false)
    expect(list.hasConsent(s.projectId, FONT, sha.toUpperCase())).toBe(false)
    expect(list.hasConsent(`${s.projectId}:${FONT}`, sha, '')).toBe(false)
  })
})

describe('the consent file [P9-9, A-260, security]', () => {
  const damaged: Array<[string, string | Buffer]> = [
    ['not JSON', '{ not json'],
    ['the wrong format', JSON.stringify({ format: 2, keys: [] })],
    ['a key of the wrong form', JSON.stringify({ format: 1, keys: ['anything'] })],
    ['an extra field', JSON.stringify({ format: 1, keys: [], more: true })],
    ['over 1 MiB', Buffer.alloc(1024 * 1024 + 1, 0x20)],
  ]

  it.each(damaged)('counts a file of %s as empty', async (_name, body) => {
    s = await setUp()
    await consent(s, FONT)
    const good = JSON.parse(fs.readFileSync(consentFile(s), 'utf8')) as { keys: string[] }
    const planted =
      typeof body === 'string' && body.includes('anything')
        ? JSON.stringify({ format: 1, keys: [...good.keys, 'anything'] })
        : body
    fs.writeFileSync(consentFile(s), planted)
    expect((await shares(s))[FONT]).toBe('needs_confirming')
    expect(s.fx.readLogs()).not.toContain('anything')
  })

  it('counts more than 10,000 keys as empty', async () => {
    s = await setUp()
    await consent(s, FONT)
    const good = JSON.parse(fs.readFileSync(consentFile(s), 'utf8')) as { keys: string[] }
    const filler = Array.from({ length: 10_000 }, () => good.keys[0])
    fs.writeFileSync(consentFile(s), JSON.stringify({ format: 1, keys: filler }))
    expect((await shares(s))[FONT]).toBe('needs_confirming')
  })

  it('writes a new list over a damaged one, through a .partial file and a rename', async () => {
    s = await setUp()
    fs.mkdirSync(s.fx.userData, { recursive: true })
    fs.writeFileSync(consentFile(s), '{ not json')
    expect((await consent(s, FONT)).ok).toBe(true)
    expect((await shares(s))[FONT]).toBe('confirmed')
    expect(fs.existsSync(`${consentFile(s)}.partial`)).toBe(false)
  })

  it('replaces a link at the consent file, never writing through it', async () => {
    s = await setUp()
    const outside = path.join(s.fx.root, 'outside.json')
    fs.writeFileSync(outside, 'keep me')
    fs.mkdirSync(s.fx.userData, { recursive: true })
    fs.symlinkSync(outside, consentFile(s))
    expect((await shares(s))[FONT]).toBe('needs_confirming')
    expect((await consent(s, FONT)).ok).toBe(true)
    expect(fs.readFileSync(outside, 'utf8')).toBe('keep me')
    expect(fs.lstatSync(consentFile(s)).isSymbolicLink()).toBe(false)
  })

  it('refuses a link at the .partial file and writes nothing through it', async () => {
    s = await setUp()
    const outside = path.join(s.fx.root, 'outside.json')
    fs.writeFileSync(outside, 'keep me')
    fs.mkdirSync(s.fx.userData, { recursive: true })
    fs.symlinkSync(outside, `${consentFile(s)}.partial`)
    expect((await consent(s, FONT)).ok).toBe(false)
    expect(fs.readFileSync(outside, 'utf8')).toBe('keep me')
    expect((await shares(s))[FONT]).toBe('needs_confirming')
  })
})

describe('publish.setFontConsent [P9-9, A-260]', () => {
  it('is AGENT_DENIED and writes nothing', async () => {
    s = await setUp()
    const input = { projectId: s.projectId, assetId: FONT, allowed: true }
    expect(await s.fx.agent('publish.setFontConsent', input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('publish.setFontConsent') },
    })
    expect(fs.existsSync(consentFile(s))).toBe(false)
  })

  it.each([
    ['a picture', PICTURE],
    ['an asset not in the project', id(90)],
    ['an ID that is not a ULID', '../../font'],
  ])('refuses %s with NOT_FOUND and writes nothing', async (_name, assetId) => {
    s = await setUp()
    const reply = await consent(s as InspectSetUp, assetId)
    expect(reply).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(fs.existsSync(consentFile(s))).toBe(false)
  })

  it('refuses a font whose file is gone, with no path in the reply', async () => {
    s = await setUp()
    fs.rmSync(files[FONT] as string)
    const reply = await consent(s, FONT)
    expect(reply).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    expect(JSON.stringify(reply)).not.toContain(path.sep + 'files')
    expect(fs.existsSync(consentFile(s))).toBe(false)
  })

  it('checks its input', async () => {
    s = await setUp()
    const bad = { projectId: s.projectId, assetId: FONT, allowed: 'yes' }
    expect(await s.fx.user('publish.setFontConsent', bad)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})
