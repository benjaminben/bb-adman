import { describe, it, expect } from 'vitest'
import { createUndoLists, UNDO_LIMIT } from '../../../../src/main/history/undo-lists'

const call = (n: number) => ({ name: 'test.set', input: { value: n } })

describe('undo lists [SPEC 4.2, R-17]', () => {
  it('keeps one list per scope and per project', () => {
    const lists = createUndoLists()
    lists.record('p1', 'variant:a', call(1))
    lists.record('p1', 'campaign:c', call(2))
    lists.record('p2', 'variant:a', call(3))
    expect(lists.takeUndo('p1', 'variant:a')).toEqual(call(1))
    expect(lists.takeUndo('p1', 'variant:a')).toBeUndefined()
    expect(lists.takeUndo('p1', 'campaign:c')).toEqual(call(2))
    expect(lists.takeUndo('p2', 'variant:a')).toEqual(call(3))
  })

  it('undoes in reverse order and reports what is available', () => {
    const lists = createUndoLists()
    expect(lists.state('p', 'variant:a')).toEqual({ canUndo: false, canRedo: false })
    lists.record('p', 'variant:a', call(1))
    lists.record('p', 'variant:a', call(2))
    expect(lists.state('p', 'variant:a')).toEqual({ canUndo: true, canRedo: false })
    expect(lists.takeUndo('p', 'variant:a')).toEqual(call(2))
    lists.recordRedo('p', 'variant:a', call(20))
    expect(lists.state('p', 'variant:a')).toEqual({ canUndo: true, canRedo: true })
    expect(lists.takeRedo('p', 'variant:a')).toEqual(call(20))
  })

  it('clears the redo list when a new edit is recorded', () => {
    const lists = createUndoLists()
    lists.recordRedo('p', 'variant:a', call(9))
    lists.record('p', 'variant:a', call(1))
    expect(lists.state('p', 'variant:a').canRedo).toBe(false)
  })

  it('keeps the redo list when the entry comes from a redo', () => {
    const lists = createUndoLists()
    lists.recordRedo('p', 'variant:a', call(9))
    lists.recordRedo('p', 'variant:a', call(8))
    lists.takeRedo('p', 'variant:a')
    lists.record('p', 'variant:a', call(1), { fromRedo: true })
    expect(lists.state('p', 'variant:a')).toEqual({ canUndo: true, canRedo: true })
  })

  it('holds at most 200 entries per list and drops the oldest', () => {
    const lists = createUndoLists()
    expect(UNDO_LIMIT).toBe(200)
    for (let i = 0; i < 205; i++) lists.record('p', 'variant:a', call(i))
    const taken: number[] = []
    for (;;) {
      const entry = lists.takeUndo('p', 'variant:a')
      if (!entry) break
      taken.push((entry.input as { value: number }).value)
    }
    expect(taken).toHaveLength(200)
    expect(taken.at(-1)).toBe(5)
  })

  it('clears one scope, as a campaign command that changes a variant must', () => {
    const lists = createUndoLists()
    lists.record('p', 'variant:a', call(1))
    lists.recordRedo('p', 'variant:a', call(2))
    lists.clear('p', 'variant:a')
    expect(lists.state('p', 'variant:a')).toEqual({ canUndo: false, canRedo: false })
  })

  it('drops every list of a project when it closes [FR-006]', () => {
    const lists = createUndoLists()
    lists.record('p', 'variant:a', call(1))
    lists.record('p', 'campaign:c', call(2))
    lists.record('q', 'variant:a', call(3))
    lists.dropProject('p')
    expect(lists.state('p', 'variant:a').canUndo).toBe(false)
    expect(lists.state('p', 'campaign:c').canUndo).toBe(false)
    expect(lists.state('q', 'variant:a').canUndo).toBe(true)
  })
})
