// spec/editor-commands.md, "layer.reorder": the new order for one step and for a drop, lowest
// first, or null when nothing changes (so no command is sent).
import { describe, expect, it } from 'vitest'
import { dropped, placed, stackOrder, stepped } from '@/renderer/editor/layer-list/stack-order'
import { LAYERS } from './layer-list-harness'

const ORDER = ['L1', 'L2', 'L3']

describe('stack order [P3-12]', () => {
  it('lists the non-background layers lowest first', () => {
    expect(stackOrder(LAYERS)).toEqual(ORDER)
  })

  it.each([
    ['L2', 1, ['L1', 'L3', 'L2']],
    ['L2', -1, ['L2', 'L1', 'L3']],
    ['L3', 1, null],
    ['L1', -1, null],
    ['L0', 1, null],
  ] as const)('steps %s by %d', (id, by, want) => {
    expect(stepped(ORDER, id, by)).toEqual(want)
  })

  it.each([
    ['L1', 'L3', true, ['L2', 'L3', 'L1']],
    ['L3', 'L1', false, ['L3', 'L1', 'L2']],
    ['L3', 'L0', true, ['L3', 'L1', 'L2']],
    ['L1', 'L0', false, null],
    ['L2', 'L2', true, null],
    ['L2', 'L1', true, null],
  ])('drops %s on %s (above %s)', (id, target, above, want) => {
    expect(dropped(ORDER, id, target, above)).toEqual(want)
  })

  it('places nothing for a layer not in the order', () => {
    expect(placed(ORDER, 'L9', 0)).toBeNull()
  })
})
