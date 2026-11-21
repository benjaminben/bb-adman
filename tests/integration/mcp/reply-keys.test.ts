// B-1 (REVIEW-Phase2-MCP-B): get_project and get_campaign give whole wire rows, so a field
// added to a row later would leave through them. This test walks every key of their replies,
// over a project and campaign with every field filled, and fails on a key named like a path,
// an address or a secret (SPEC 4.5; 14 1.56 point 8; FR-198).
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import { toolSession, replyJson } from './tool-client'
import { createInput } from '../campaigns/campaign-fixture'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

const RISKY = /path|dir|file|url|address|host|token|secret|key/i

// Today's harmless keys whose names only contain a risky word.
const HARMLESS = new Set([
  'directions', // the campaign's direction rows ("dir")
  'directionId', // a variant's direction ID ("dir")
  'missingFile', // a variant badge, true or false ("file")
])

// Record keys are data (a language code, for example), so only object keys are checked.
export function riskyKeys(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => riskyKeys(v, `${at}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => {
    const here = at ? `${at}.${k}` : k
    const own = RISKY.test(k) && !HARMLESS.has(k) ? [here] : []
    return [...own, ...riskyKeys(v, here)]
  })
}

function fullInput() {
  const base = createInput()
  return {
    ...base,
    brief: {
      ...base.brief,
      subjects: [
        { id: 'can', name: 'Can', description: 'A red can' },
        { id: 'bottle', name: 'Bottle', description: 'A green bottle' },
      ],
      offer: 'Two for one',
      callToAction: 'Buy now',
      tone: 'Bright',
      languages: ['en', 'de'],
      sizes: ['1x1', '9x16'],
      copy: { en: { headline: 'Stay cool', callToAction: 'Buy now' } },
    },
    ruleSet: {
      requiredAssetIds: ['a1'],
      palette: ['#FF0000'],
      requiredWords: { en: ['fresh'] },
      prohibitedWords: { en: ['cheap'] },
    },
  }
}

async function filledProject(fx: McpFixture) {
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'Keys', location: fx.projectsDir }),
  )
  const abs = path.join(fx.root, 'made-up-folder', 'made-up-key-picture.png')
  fx.core.projects
    .requireOpen(projectId)
    .db.prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name,
        abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
       VALUES ('a1', 'asset', 'image', 'imported', 'linked', NULL, 'Picture', ?,
        'made-up-folder/made-up-key-picture.png', 'image/png', 1, 1, 'h', '2026-01-01T00:00:00Z')`,
    )
    .run(abs)
  const { campaignId } = data<{ campaignId: string }>(
    await fx.user('campaign.create', { projectId, ...fullInput() }),
  )
  return { projectId, campaignId }
}

describe('get_project and get_campaign give no key named like a path or secret [B-1; FR-198]', () => {
  it('the key check finds a risky key at any depth', () => {
    const planted = { a: [{ ok: 1, nested: { absPath: 'x', apiKey: 'y' } }], hostName: 'z' }
    expect(riskyKeys(planted)).toEqual(['a[0].nested.absPath', 'a[0].nested.apiKey', 'hostName'])
  })

  it('holds for a project and campaign with every field filled', async () => {
    f = await makeMcpFixture()
    const ids = await filledProject(f)
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const s = await toolSession(f.port, await f.token())
    const args = { project_id: ids.projectId, campaign_id: ids.campaignId }
    for (const name of ['get_project', 'get_campaign']) {
      const reply = await s.call(name, args)
      expect(reply.isError, name).toBeFalsy()
      const json = replyJson(reply)
      expect(JSON.stringify(json).includes(ids.campaignId), name).toBe(true)
      expect(riskyKeys(json), name).toEqual([])
    }
  })
})
