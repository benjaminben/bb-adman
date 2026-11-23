import { describe, it, expect, beforeEach } from 'vitest'
import {
  CHOSEN_WORKFLOW_TTL_MS,
  forgetWorkflowPath,
  rememberWorkflowPath,
  takeWorkflowPath,
} from '@/main/providers/comfyui/custom/chosen-workflow-path'

beforeEach(() => forgetWorkflowPath())

describe('the workflow file the picker gave [D-104, security rule 9]', () => {
  it('is taken once, within 10 minutes', () => {
    rememberWorkflowPath('/w/flow.json', 1_000)
    expect(takeWorkflowPath('/w/flow.json', 1_000 + CHOSEN_WORKFLOW_TTL_MS)).toBe('/w/flow.json')
    expect(takeWorkflowPath('/w/flow.json', 1_000 + CHOSEN_WORKFLOW_TTL_MS)).toBeNull()
  })

  it('is refused after 10 minutes, and forgotten', () => {
    rememberWorkflowPath('/w/flow.json', 1_000)
    expect(takeWorkflowPath('/w/flow.json', 1_001 + CHOSEN_WORKFLOW_TTL_MS)).toBeNull()
    expect(takeWorkflowPath('/w/flow.json', 1_000)).toBeNull()
  })

  it('refuses another path and keeps the choice', () => {
    rememberWorkflowPath('/w/flow.json', 1_000)
    expect(takeWorkflowPath('/w/other.json', 1_000)).toBeNull()
    // The caller reads only the path given back: the remembered one, never its own text.
    expect(takeWorkflowPath('/w/sub/../flow.json', 1_000)).toBe('/w/flow.json')
  })

  it('refuses when nothing was picked', () => {
    expect(takeWorkflowPath('/w/flow.json')).toBeNull()
  })

  it('keeps only the newest choice', () => {
    rememberWorkflowPath('/w/a.json', 1_000)
    rememberWorkflowPath('/w/b.json', 1_000)
    expect(takeWorkflowPath('/w/a.json', 1_000)).toBeNull()
    expect(takeWorkflowPath('/w/b.json', 1_000)).toBe('/w/b.json')
  })
})
