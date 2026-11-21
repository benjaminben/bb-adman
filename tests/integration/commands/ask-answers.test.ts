// P10-1 (spec/phases/phase-10.md, "Design additions", ask flow, A-237): the bus hands the ask
// the command, the client, the project and the parsed input, and maps each answer to one
// outcome. Only true and 'allowed' run the command; every other answer refuses with its own
// reason and writes nothing.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'
import { createCommandBus, type AskAnswer, type PermissionRequest } from '@/main/commands/bus'
import { createActivityLog } from '@/main/log/activity-log'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

function setup(answer: () => Promise<unknown>) {
  const f = makeBusFixture([])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-ask-'))
  cleanups.push(f.cleanup, () => fs.rmSync(dir, { recursive: true, force: true }))
  const asked: PermissionRequest[] = []
  const bus = createCommandBus({
    handlers: [setValueHandler('variant.delete')],
    projects: f.projects,
    undo: f.undo,
    log: createActivityLog({ dir, minLevel: 'debug', now: () => new Date() }),
    emit: (e) => f.events.push(e),
    askPermission: async (req) => {
      asked.push(req)
      return (await answer()) as boolean | AskAnswer
    },
  })
  return { ...f, bus, asked }
}

const refused = (message: string, reason: string) => ({
  ok: false,
  error: { code: 'AGENT_REFUSED', message, details: { reason } },
})
const NOT_ALLOWED = refused('The user did not allow this action.', 'refused')
const TIMED_OUT = refused('The user did not answer in time.', 'timed_out')
const BUSY = refused(
  "Another request is waiting for the user's answer. Try again after it.",
  'busy',
)
const RAN = { ok: true, data: { value: 'a' } }

const ANSWERS: Array<{ answer: unknown; reply: object }> = [
  { answer: true, reply: RAN },
  { answer: false, reply: NOT_ALLOWED },
  { answer: 'allowed', reply: RAN },
  { answer: 'refused', reply: NOT_ALLOWED },
  { answer: 'timed_out', reply: TIMED_OUT },
  { answer: 'busy', reply: BUSY },
  // Fail closed: an answer the bus does not know is a refusal.
  { answer: 'yes', reply: NOT_ALLOWED },
  { answer: undefined, reply: NOT_ALLOWED },
]

describe('the answers to an ask [P10-1, A-237]', () => {
  it.each(ANSWERS)('answer $answer gives its outcome', async ({ answer, reply }) => {
    const f = setup(async () => answer)
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a', extra: 'dropped' },
      { actor: 'agent', agentClient: 'Made-up Client' },
    )
    expect(result).toEqual(reply)
    expect(f.value()).toBe(reply === RAN ? 'a' : null)
    if (reply !== RAN) expect(f.events).toEqual([])
  })

  it('hands the ask the command, the client, the project and the parsed input', async () => {
    const f = setup(async () => false)
    await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a', extra: 'dropped' },
      { actor: 'agent', agentClient: 'Made-up Client' },
    )
    expect(f.asked).toEqual([
      {
        command: 'variant.delete',
        agentClient: 'Made-up Client',
        projectId: f.projectId,
        input: { projectId: f.projectId, value: 'a' },
      },
    ])
  })

  it('runs nothing when the ask itself fails', async () => {
    const f = setup(async () => {
      throw new Error('made-up failure')
    })
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a' },
      { actor: 'agent' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(f.value()).toBeNull()
  })

  it('does not ask for the user', async () => {
    const f = setup(async () => false)
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a' },
      { actor: 'user' },
    )
    expect(result).toEqual(RAN)
    expect(f.asked).toEqual([])
  })
})
