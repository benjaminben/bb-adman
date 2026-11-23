// CW-6a (spec/comfyui-custom.md "The agent's ask"): the broker's workflow reader and the add
// ask's target line. Pure: nothing is read from disk.
import { describe, expect, it } from 'vitest'
import { fixtureText } from '../../../fixtures/comfy-custom/load'
import { readAskedWorkflow, workflowAddLine } from '@/main/mcp/ask-workflow-reader'

const read = (workflowJson: string, name = 'Studio clip') =>
  readAskedWorkflow({ name, workflowJson })

describe('the workflow reader [CW-6a]', () => {
  it('reads a video from reference pictures with its start and count', () => {
    const held = read(fixtureText('video-refs'))
    expect(held.view).toMatchObject({ name: 'Studio clip', job: 'video', start: 'references' })
    expect(workflowAddLine(held)).toMatch(
      /^Workflow "Studio clip": Video from (1 reference picture|\d+ reference pictures), \d+ node types$/,
    )
  })

  it('says "1 node type" for a single type', () => {
    const line = workflowAddLine({
      view: { name: 'One', job: 'image', start: null, nodeTypes: ['KSampler'] },
      references: 0,
    })
    expect(line).toBe('Workflow "One": Picture from a prompt, 1 node type')
  })

  it('refuses a text that is not JSON with the fixed sentence, holding none of the text', () => {
    let message = ''
    try {
      read('{"QX7MARKER": ')
    } catch (e) {
      message = JSON.stringify(e) + String(e)
    }
    expect(message).not.toBe('')
    expect(message.includes('QX7MARKER')).toBe(false)
  })
})
