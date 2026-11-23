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

describe('the comfyWorkflow commands for an agent: two deny, two ask (CW-6a) [D-104, rule 7]', () => {
  it('has a deny row for addFromFile and update, an ask row for add and remove', () => {
    for (const name of ['addFromFile', 'update']) {
      expect(agentPolicyFor(`comfyWorkflow.${name}`)).toBe('deny')
    }
    for (const name of ['add', 'remove']) {
      expect(agentPolicyFor(`comfyWorkflow.${name}`)).toBe('ask')
    }
  })

  it('refuses each (AGENT_DENIED, or AGENT_REFUSED by a refused ask) and changes nothing', async () => {
    f = makeFixture()
    const id = f.core.deps.comfyWorkflows.add({
      checked: checked('picture'),
      name: 'Beach',
      addedBy: 'user',
    }).stored.id
    const file = path.join(f.root, 'beach.json')
    fs.writeFileSync(file, fixtureText('picture'))
    rememberWorkflowPath(file)
    const calls: Array<[string, unknown, string]> = [
      ['comfyWorkflow.addFromFile', { filePath: file }, 'AGENT_DENIED'],
      ['comfyWorkflow.add', { name: 'Other', workflowJson: fixtureText('two-refs') }, 'AGENT_REFUSED'],
      ['comfyWorkflow.update', { workflowId: id, name: 'Renamed' }, 'AGENT_DENIED'],
      ['comfyWorkflow.remove', { workflowId: id }, 'AGENT_REFUSED'],
    ]
    for (const [name, input, code] of calls) {
      expect(await f.agent(name, input), name).toMatchObject({
        ok: false,
        error: { code },
      })
    }
    expect(f.core.deps.comfyWorkflows.list().map((e) => e.stored.name)).toEqual(['Beach'])
    expect(fs.readdirSync(path.join(f.userData, 'comfy-workflows'))).toEqual([`${id}.json`])
  })
})
