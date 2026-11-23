// CW-8, from the CW-6a review (spec/comfyui-custom.md "The agent's ask", "Security" rules 2
// and 6): through the real permission broker, an agent's add that fails a file check is refused
// before any ask, and nothing is read from disk for an agent.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { askSetUp, type AskSetUp } from '../mcp/ask-fixture'
import { replyJson } from '../mcp/tool-client'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { MARKER, markedGraph } from './marked-graph'

let x: AskSetUp | undefined
let dir: string | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

const saved = (s: AskSetUp) => s.core.deps.comfyWorkflows.list()

describe('a marked graph that fails a later file check [CW-8, item 4]', () => {
  it('is refused with no ask event, and the marker is in no reply, event or log line', async () => {
    x = await askSetUp()
    const text = markedGraph({ noOutput: true })
    const expected = checkWorkflowText(text)
    expect(expected).toMatchObject({
      ok: false,
      error: { details: { reason: 'workflow_mark_missing' } },
    })
    if (expected.ok) return
    const t = await x.session()
    const tool = await t.call('add_comfy_workflow', { name: 'Harbour', workflow_json: text })
    const bus = await x.agent('comfyWorkflow.add', { name: 'Harbour', workflowJson: text })
    const replies = [tool, bus]
    expect(tool.isError).toBe(true)
    expect(replyJson(tool)).toEqual(expected.error)
    expect(bus).toEqual({ ok: false, error: expected.error })
    expect(x.asked()).toEqual([])
    expect(saved(x)).toEqual([])
    const seen = JSON.stringify([replies, x.events]) + x.readLogs()
    expect(seen.toLowerCase()).not.toContain(MARKER.toLowerCase())
  })
})

describe('nothing is read from disk for an agent [CW-8, item 5]', () => {
  // The command's input is strict, so a filePath key is INVALID_INPUT. The MCP door drops
  // unknown keys before the command runs (spec/mcp-and-agents.md "Actor"), so there the key
  // has no effect: the file, a graph that would pass and ask, is never read.
  it('refuses a filePath key by the command schema; the MCP door drops file_path unread', async () => {
    x = await askSetUp()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-agent-path-'))
    const file = path.join(dir, 'harbour.json')
    fs.writeFileSync(file, markedGraph())
    const byBus = await x.agent('comfyWorkflow.add', {
      name: 'Harbour',
      workflowJson: '{}',
      filePath: file,
    })
    expect(byBus).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    const t = await x.session()
    const reply = await t.call('add_comfy_workflow', {
      name: 'Harbour',
      workflow_json: '{}',
      file_path: file,
    })
    const empty = checkWorkflowText('{}')
    if (empty.ok) throw new Error('an empty object passed the checks')
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(empty.error)
    expect(x.asked()).toEqual([])
    expect(saved(x)).toEqual([])
    const seen = JSON.stringify([byBus, reply, x.events]) + x.readLogs()
    expect(seen.toLowerCase()).not.toContain(MARKER.toLowerCase())
    expect(seen.toLowerCase()).not.toContain(path.basename(dir).toLowerCase())
  })

  it('refuses a workflow_json that is a file path as not JSON, with no ask and no file read', async () => {
    x = await askSetUp()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-agent-path-'))
    // A graph that would pass every check, so reading it would lead to an ask.
    const file = path.join(dir, 'harbour.json')
    fs.writeFileSync(file, markedGraph())
    expect(checkWorkflowText(fs.readFileSync(file, 'utf8')).ok).toBe(true)
    const t = await x.session()
    const tool = await t.call('add_comfy_workflow', { name: 'Harbour', workflow_json: file })
    const bus = await x.agent('comfyWorkflow.add', { name: 'Harbour', workflowJson: file })
    const replies = [tool, bus]
    const notJson = {
      code: 'RULE_VIOLATION',
      message: 'This file is not a ComfyUI workflow.',
      details: { reason: 'workflow_not_json' },
    }
    expect(tool.isError).toBe(true)
    expect(replyJson(tool)).toEqual(notJson)
    expect(bus).toEqual({ ok: false, error: notJson })
    expect(x.asked()).toEqual([])
    expect(saved(x)).toEqual([])
    const seen = JSON.stringify([replies, x.events]) + x.readLogs()
    expect(seen.toLowerCase()).not.toContain(MARKER.toLowerCase())
    expect(seen.toLowerCase()).not.toContain(path.basename(dir).toLowerCase())
  })
})
