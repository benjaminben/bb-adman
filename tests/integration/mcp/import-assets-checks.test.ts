// R2P-5 (spec/phases/round-2-platform.md, D5 and D7; security class full): after the user
// allowed, each shown path is checked again on disk; one failure refuses the call and leaves no
// copy. No reply, refusal, event or log line holds a given path or file name. The broker
// refuses an ask that has no kind, and the neighbouring commands stay denied.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import { riskyKeys } from './ask-fixture'
import { importSetUp, pngBytes, ttfBytes, type ImportSetUp } from './import-assets-fixture'
import { createPermissionBroker } from '@/main/mcp/permissions'
import type { BusEvent } from '@/main/commands/bus'
import type { Core } from '@/main/core'

let x: ImportSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

// Runs the agent's command, allows the ask (with rememberAuto, which an import never keeps) and
// gives the reply.
async function allowed(s: ImportSetUp, paths: string[], replies: unknown[] = []) {
  const n = s.asked().length + 1
  const pending = s.agent('asset.importFiles', { projectId: s.projectId, paths })
  const asked = await s.nthAsk(n)
  data(
    await s.user('agent.answerPermission', {
      requestId: asked.requestId,
      allow: true,
      rememberAuto: true,
    }),
  )
  const reply = await pending
  replies.push(reply)
  return reply
}

const refusal = (code: string, reason: string, message: string) => ({
  ok: false,
  error: { code, message, details: { reason } },
})

describe('the checks after the allow [R2P-5; D5]', () => {
  it.each([
    [
      'a folder',
      (s: ImportSetUp) => (
        fs.mkdirSync(path.join(s.dir, 'folder.png')),
        path.join(s.dir, 'folder.png')
      ),
      refusal('RULE_VIOLATION', 'not_a_file', 'File 2 is not a file.'),
    ],
    [
      'a link to the file',
      (s: ImportSetUp) => {
        const link = path.join(s.dir, 'link.png')
        fs.symlinkSync(s.put('outside/real.png', pngBytes(5)), link)
        return link
      },
      refusal(
        'RULE_VIOLATION',
        'file_is_link',
        "File 2 is reached through a link. Give the file's own full path.",
      ),
    ],
    [
      'a link to a folder on the way',
      (s: ImportSetUp) => {
        s.put('real-folder/hero.png', pngBytes(6))
        fs.symlinkSync(path.join(s.dir, 'real-folder'), path.join(s.dir, 'via'))
        return path.join(s.dir, 'via', 'hero.png')
      },
      refusal(
        'RULE_VIOLATION',
        'file_is_link',
        "File 2 is reached through a link. Give the file's own full path.",
      ),
    ],
    [
      'an SVG renamed .png',
      (s: ImportSetUp) => s.put('drawing.png', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
      refusal(
        'RULE_VIOLATION',
        'not_supported',
        'File 2 is not a picture, video or font Adman can use.',
      ),
    ],
    [
      'a missing file',
      (s: ImportSetUp) => path.join(s.dir, 'gone.ttf'),
      refusal('NOT_FOUND', 'file_not_found', 'File 2 was not found.'),
    ],
  ])('refuses %s as file 2 and leaves no copy of file 1', async (_name, second, expected) => {
    x = await importSetUp()
    const first = x.put('first.png', pngBytes(4))
    const p = second(x)
    const before = x.projectFiles()
    expect(await allowed(x, [first, p])).toEqual(expected)
    expect(x.projectFiles()).toEqual(before)
    expect(x.assetRows()).toEqual([])
  })

  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'refuses a file that cannot be read, and the warn line holds no path',
    async () => {
      x = await importSetUp()
      const locked = x.put('locked-name.png', pngBytes(7))
      fs.chmodSync(locked, 0)
      try {
        expect(await allowed(x, [locked])).toEqual(
          refusal('RULE_VIOLATION', 'file_not_readable', 'File 1 could not be read.'),
        )
      } finally {
        fs.chmodSync(locked, 0o644)
      }
      const logs = x.readLogs()
      expect(logs).toContain('A file could not be read (EACCES).')
      expect(logs).not.toContain('locked-name')
    },
  )

  it('gives the existing ID for a file the project holds, and one copy for a file named twice', async () => {
    x = await importSetUp()
    const a = x.put('a.png', pngBytes(8))
    const same = x.put('elsewhere/same-bytes.png', pngBytes(8))
    const font = x.put('Brand.ttf', ttfBytes())
    const first = data<{ assetIds: string[] }>(await allowed(x, [a]))
    const files = x.projectFiles().length
    const second = data<{ assetIds: string[] }>(await allowed(x, [same, font, font]))
    expect(second.assetIds[0]).toBe(first.assetIds[0])
    expect(second.assetIds[1]).toBe(second.assetIds[2])
    expect(x.assetRows()).toHaveLength(2)
    expect(x.projectFiles()).toHaveLength(files + 1)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
  })
})

describe('nothing about a path leaves [R2P-5; D5]', () => {
  it('holds for every reply, refusal, event and log line, success and refusal', async () => {
    x = await importSetUp()
    const s = await x.session()
    const good = [x.put('Secret Plans/hero-shot.png', pngBytes(9)), x.put('Brand.ttf', ttfBytes())]
    const missing = path.join(x.dir, 'Secret Plans', 'not-there.png')
    const replies: unknown[] = []
    const pending = s.call('import_assets', { project_id: x.projectId, paths: good })
    const asked = await x.nthAsk()
    data(
      await x.user('agent.answerPermission', {
        requestId: asked.requestId,
        allow: true,
        rememberAuto: false,
      }),
    )
    const success = await pending
    expect(success.isError).toBeFalsy()
    replies.push(replyJson(success))
    await allowed(x, [missing], replies)
    for (const bad of [['relative/hero-shot.png'], [`${x.dir}/notes.txt`]]) {
      replies.push(
        replyJson(await s.call('import_assets', { project_id: x.projectId, paths: bad })),
      )
    }
    expect(riskyKeys(replies)).toEqual([])
    // project.changed is the window's own row update after the allow, as for a person's import:
    // the new rows, with their display names (the base names) and the copies' places in the
    // project's assets folder, never a given path or its folder.
    const rowEvents = x.events.filter((e) => e.name === 'project.changed')
    const otherEvents = x.events.filter((e) => e.name !== 'project.changed')
    const names = ['hero-shot', 'Brand.ttf', 'not-there', 'notes.txt']
    const folders = [x.dir, 'Secret Plans']
    const places: Array<[string, string, string[]]> = [
      ['reply', JSON.stringify(replies), [...folders, ...names]],
      ['event', JSON.stringify(otherEvents), [...folders, ...names]],
      ['project.changed', JSON.stringify(rowEvents), [...folders, 'not-there', 'notes.txt']],
      ['log', x.readLogs(), [...folders, ...names]],
    ]
    for (const [where, text, words] of places) {
      for (const word of [...words, 'comfyui', 'baseUrl', 'agentRuns', 'autoApprove']) {
        expect(text.includes(word), `${word} in ${where}`).toBe(false)
      }
    }
    expect(
      rowEvents.filter((e) => (e.payload as { actor?: string }).actor === 'agent'),
    ).toHaveLength(1)
    expect(Object.keys(replyJson(success))).toEqual(['assetIds'])
  })
})

describe('what stays as it was [R2P-5; D5, D7]', () => {
  it.each([
    ['asset.import', { library: 'asset', copy: true, paths: ['/x/a.png'] }],
    ['asset.relink', { assetId: 'made-up-asset', path: '/x/a.png' }],
    ['project.package', { targetDir: '/x' }],
    ['agent.answerPermission', { requestId: 'made-up', allow: true, rememberAuto: false }],
  ])('%s is denied to an agent', async (name, input) => {
    x = await importSetUp()
    const reply = await x.agent(name, { projectId: x.projectId, ...input })
    expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
  })

  it('refuses at once an ask for a command with no kind, with no event', async () => {
    const events: BusEvent[] = []
    const lines: unknown[] = []
    const broker = createPermissionBroker({
      emit: (e) => events.push(e),
      settings: { get: () => ({ mcp: { autoApproveDestructive: true } }) } as Core['settings'],
      log: { write: (l: unknown) => lines.push(l) } as unknown as Core['log'],
      now: () => new Date(),
      projects: { get: () => undefined } as unknown as Core['projects'],
    })
    const request = { command: 'made.upAsk', agentClient: null, projectId: null, input: {} }
    expect(await broker.ask(request)).toBe('refused')
    expect(events).toEqual([])
    expect(lines).toMatchObject([{ event: 'ask', message: 'refused' }])
  })
})
