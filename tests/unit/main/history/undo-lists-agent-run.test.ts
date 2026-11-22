import { describe, it, expect } from 'vitest'
import { AGENT_RUN_LIMIT, createUndoLists, type UndoLists } from '@/main/history/undo-lists'

const call = { name: 'test.set', input: {} }
const S = 'variant:a'

type Step = (lists: UndoLists) => void
// The guard counts an agent entry when it checks (reserveAgent); recording it adds nothing.
const agent: Step = (l) => {
  l.reserveAgent('p', S)
  l.record('p', S, call, { actor: 'agent' })
}
const recordOnly: Step = (l) => l.record('p', S, call, { actor: 'agent' })
const user: Step = (l) => l.record('p', S, call, { actor: 'user' })
const userUndo: Step = (l) => l.recordRedo('p', S, call, 'user')
const userRedo: Step = (l) => l.record('p', S, call, { fromRedo: true, actor: 'user' })
const agentUndo: Step = (l) => l.recordRedo('p', S, call, 'agent')
const agentRedo: Step = (l) => {
  l.reserveAgent('p', S)
  l.record('p', S, call, { fromRedo: true, actor: 'agent' })
}
const putBack: Step = (l) => l.record('p', S, call, { fromRedo: true })
const putBackRedo: Step = (l) => l.recordRedo('p', S, call)
const take: Step = (l) => void l.takeUndo('p', S)
const other: Step = (l) => l.reserveAgent('p', 'variant:b')
const otherProject: Step = (l) => l.record('q', S, call, { actor: 'user' })

describe('agent entries in a row per undo list [A-261]', () => {
  it('stops at half the undo limit', () => {
    expect(AGENT_RUN_LIMIT).toBe(100)
  })

  it.each<[string, Step[], number]>([
    ['an empty list', [], 0],
    ['agent entries count up', [agent, agent, agent], 3],
    ['a reservation counts before anything is recorded', [agent, (l) => l.reserveAgent('p', S)], 2],
    ['recording an agent entry adds nothing', [agent, recordOnly], 1],
    ['a user entry sets it to 0', [agent, agent, user], 0],
    ['agent entries after a user entry count from 0', [agent, user, agent], 1],
    ['a user undo sets it to 0', [agent, agent, userUndo], 0],
    ['a user redo sets it to 0', [agent, agent, userRedo], 0],
    ['an agent undo does not set it to 0', [agent, agent, agentUndo], 2],
    ['an agent redo counts as an agent entry', [agent, agentRedo], 2],
    ['a put-back after a failed replay changes nothing', [agent, putBack, putBackRedo], 1],
    ['taking an entry changes nothing', [agent, agent, take], 2],
    ['another list counts apart', [agent, other, other], 1],
    ['another project counts apart', [agent, otherProject], 1],
  ])('%s', (_, steps, count) => {
    const lists = createUndoLists()
    for (const step of steps) step(lists)
    expect(lists.agentRun('p', S)).toBe(count)
  })

  it('drops the count with the list', () => {
    const lists = createUndoLists()
    agent(lists)
    lists.clear('p', S)
    expect(lists.agentRun('p', S)).toBe(0)
    agent(lists)
    lists.dropProject('p')
    expect(lists.agentRun('p', S)).toBe(0)
  })
})
