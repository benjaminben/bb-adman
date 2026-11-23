import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checked } from './store-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { serverChecks, type CheckClient } from '@/main/providers/comfyui/needs'
import { rememberWorkflowPath } from '@/main/providers/comfyui/custom/chosen-workflow-path'
import { comfyWorkflowAdd } from '@/main/commands/comfy/workflow-add'

let f: Fixture
afterEach(() => f.cleanup())

const ORIGIN = 'http://127.0.0.1:8188'

function countingClient() {
  const systemStats = vi.fn(async () => ({ comfyuiVersion: '0.3.40' }))
  const client = {
    systemStats,
    modelFiles: async () => [],
    nodeInfo: async () => true,
  } as unknown as CheckClient
  return { client, calls: () => systemStats.mock.calls.length }
}

// A kept check, then the change, then a run that may reuse the kept result.
async function keptAfter(change: () => Promise<unknown>): Promise<boolean> {
  const { client, calls } = countingClient()
  await serverChecks.run(ORIGIN, client, [], { fresh: true })
  await serverChecks.run(ORIGIN, client, [])
  expect(calls()).toBe(1)
  await change()
  await serverChecks.run(ORIGIN, client, [])
  return calls() === 1
}

const addOne = () =>
  f.core.deps.comfyWorkflows.add({ checked: checked('picture'), name: 'Beach', addedBy: 'user' })
    .stored.id

describe('every comfyWorkflow command empties the kept check results [D-104, CW-2]', () => {
  it('forget() empties them', async () => {
    f = makeFixture()
    expect(await keptAfter(async () => serverChecks.forget())).toBe(false)
  })

  it('comfyWorkflow.addFromFile', async () => {
    f = makeFixture()
    const file = path.join(f.root, 'beach.json')
    fs.writeFileSync(file, fixtureText('picture'))
    rememberWorkflowPath(file)
    const add = async () => data(await f.user('comfyWorkflow.addFromFile', { filePath: file }))
    expect(await keptAfter(add)).toBe(false)
  })

  it('comfyWorkflow.add', async () => {
    f = makeFixture()
    const handler = comfyWorkflowAdd(f.core.deps)
    const parsed = handler.parse({ name: 'Beach', workflowJson: fixtureText('picture') })
    if (!parsed.ok) throw new Error('bad input')
    expect(await keptAfter(async () => handler.run({ actor: 'agent', commandId: 'c' }, parsed.input))).toBe(false)
  })

  it('comfyWorkflow.update', async () => {
    f = makeFixture()
    const id = addOne()
    const change = async () => data(await f.user('comfyWorkflow.update', { workflowId: id, name: 'B' }))
    expect(await keptAfter(change)).toBe(false)
  })

  it('comfyWorkflow.remove', async () => {
    f = makeFixture()
    const id = addOne()
    const change = async () => data(await f.user('comfyWorkflow.remove', { workflowId: id }))
    expect(await keptAfter(change)).toBe(false)
  })

  it('a refused command keeps them', async () => {
    f = makeFixture()
    const refused = () => f.user('comfyWorkflow.remove', { workflowId: 'custom-0123456789ab' })
    expect(await keptAfter(refused)).toBe(true)
  })
})
