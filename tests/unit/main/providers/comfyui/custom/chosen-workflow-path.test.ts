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
    expect(takeWorkflowPath('/w/flow.json', 1_000 + CHOSEN_WORKFLOW_TTL_MS)).toBe(true)
    expect(takeWorkflowPath('/w/flow.json', 1_000 + CHOSEN_WORKFLOW_TTL_MS)).toBe(false)
  })

  it('is refused after 10 minutes, and forgotten', () => {
    rememberWorkflowPath('/w/flow.json', 1_000)
    expect(takeWorkflowPath('/w/flow.json', 1_001 + CHOSEN_WORKFLOW_TTL_MS)).toBe(false)
    expect(takeWorkflowPath('/w/flow.json', 1_000)).toBe(false)
  })

  it('refuses another path and keeps the choice', () => {
    rememberWorkflowPath('/w/flow.json', 1_000)
    expect(takeWorkflowPath('/w/other.json', 1_000)).toBe(false)
    expect(takeWorkflowPath('/w/sub/../flow.json', 1_000)).toBe(true)
  })

  it('refuses when nothing was picked', () => {
    expect(takeWorkflowPath('/w/flow.json')).toBe(false)
  })

  it('keeps only the newest choice', () => {
    rememberWorkflowPath('/w/a.json', 1_000)
    rememberWorkflowPath('/w/b.json', 1_000)
    expect(takeWorkflowPath('/w/a.json', 1_000)).toBe(false)
    expect(takeWorkflowPath('/w/b.json', 1_000)).toBe(true)
  })
})
