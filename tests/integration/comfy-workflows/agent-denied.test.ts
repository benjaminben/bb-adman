import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { checked } from './store-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { agentPolicyFor } from '@/main/commands/agent-policy'
import { rememberWorkflowPath } from '@/main/providers/comfyui/custom/chosen-workflow-path'

let f: Fixture | undefined
afterEach(() => f?.cleanup())

describe('the comfyWorkflow commands are deny for an agent in CW-2 [D-104, rule 7]', () => {
  it('has a deny row for each of the four', () => {
    for (const name of ['addFromFile', 'add', 'update', 'remove']) {
      expect(agentPolicyFor(`comfyWorkflow.${name}`)).toBe('deny')
    }
  })

  it('refuses each with AGENT_DENIED and changes nothing', async () => {
    f = makeFixture()
    const id = f.core.deps.comfyWorkflows.add({
      checked: checked('picture'),
      name: 'Beach',
      addedBy: 'user',
    }).stored.id
    const file = path.join(f.root, 'beach.json')
    fs.writeFileSync(file, fixtureText('picture'))
    rememberWorkflowPath(file)
    const calls: Array<[string, unknown]> = [
      ['comfyWorkflow.addFromFile', { filePath: file }],
      ['comfyWorkflow.add', { name: 'Other', workflowJson: fixtureText('two-refs') }],
      ['comfyWorkflow.update', { workflowId: id, name: 'Renamed' }],
      ['comfyWorkflow.remove', { workflowId: id }],
    ]
    for (const [name, input] of calls) {
      expect(await f.agent(name, input), name).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED' },
      })
    }
    expect(f.core.deps.comfyWorkflows.list().map((e) => e.stored.name)).toEqual(['Beach'])
    expect(fs.readdirSync(path.join(f.userData, 'comfy-workflows'))).toEqual([`${id}.json`])
  })
})
