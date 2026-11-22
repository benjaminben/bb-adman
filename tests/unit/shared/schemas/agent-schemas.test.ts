// P10-1: the agent.answerPermission input (strict), the subject.list input, and the two
// Phase 10 events, whose payloads hold no input, key, token or path (A-238, A-241).
import { describe, it, expect, expectTypeOf } from 'vitest'
import { agentAnswerPermissionInput } from '@/shared/schemas/commands/agent'
import { subjectListInput } from '@/shared/schemas/queries/subject'
import { EVENT_NAMES, type EventMap } from '@/shared/schemas/events'

const GOOD = { requestId: 'R1', allow: false, rememberAuto: false }

describe('agent.answerPermission input [P10-1]', () => {
  it('takes a request ID and the two answers', () => {
    expect(agentAnswerPermissionInput.parse(GOOD)).toEqual(GOOD)
  })

  it.each([
    ['an unknown key', { ...GOOD, actor: 'user' }],
    ['no requestId', { allow: true, rememberAuto: false }],
    ['an empty requestId', { ...GOOD, requestId: '' }],
    ['no allow', { requestId: 'R1', rememberAuto: false }],
    ['no rememberAuto', { requestId: 'R1', allow: true }],
    ['a text allow', { ...GOOD, allow: 'yes' }],
  ])('refuses %s', (_label, input) => {
    expect(agentAnswerPermissionInput.safeParse(input).success).toBe(false)
  })
})

describe('subject.list input [P10-1, A-235]', () => {
  it('takes a project ID only', () => {
    expect(subjectListInput.parse({ projectId: 'P1' })).toEqual({ projectId: 'P1' })
    expect(subjectListInput.safeParse({}).success).toBe(false)
  })
})

describe('the Phase 10 events [P10-1, A-238, A-241]', () => {
  it('lists agent.permissionRequested and agent.activity', () => {
    expect(EVENT_NAMES).toEqual(
      expect.arrayContaining(['agent.permissionRequested', 'agent.activity']),
    )
  })

  it('gives the permission request its action and target lines, no ID of the target', () => {
    expectTypeOf<EventMap['agent.permissionRequested']>().toEqualTypeOf<{
      requestId: string
      agentClient: string | null
      action: string
      target: string
      expiresAt: string
      kind: 'delete' | 'import'
      fileCount: number
    }>()
  })

  it('gives the activity the tool, project, outcome and time only', () => {
    expectTypeOf<EventMap['agent.activity']>().toEqualTypeOf<{
      tool: string
      projectId: string | null
      ok: boolean
      at: string
    }>()
  })
})
