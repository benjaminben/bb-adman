import { describe, it, expect } from 'vitest'
import { acceptDone, type DoneExpectation } from '@/main/render/done-message'

const mainFrame = { processId: 3, routingId: 1 }
const contents = { mainFrame }
const expected: DoneExpectation = {
  contents,
  requestId: '01JD0000000000000000000001',
  textLayerIds: ['T1', 'T2'],
}
const good = { sender: contents, senderFrame: mainFrame }
const message = { requestId: expected.requestId, overflow: { T1: true, T2: false } }

// spec/scene.md "One draw" step 4; spec/security.md "Rules: the render window".
describe('acceptDone [P3-6]', () => {
  it('takes a reply from the render window main frame for the awaited request', () => {
    expect(acceptDone(good, message, expected)).toEqual({ T1: true, T2: false })
  })

  it.each([
    ['another window', { sender: { mainFrame }, senderFrame: mainFrame }, message],
    [
      'a frame inside the page',
      { sender: contents, senderFrame: { processId: 3, routingId: 2 } },
      message,
    ],
    ['a frame that is gone', { sender: contents, senderFrame: null }, message],
    ['another request', good, { ...message, requestId: '01JD0000000000000000000002' }],
    ['no request ID', good, { overflow: {} }],
    ['an extra key', good, { ...message, png: 'x' }],
    ['a value that is not true or false', good, { ...message, overflow: { T1: 'yes' } }],
    ['no object at all', good, 'done'],
    ['null', good, null],
  ])('ignores a reply from or with %s', (_label, event, body) => {
    expect(acceptDone(event, body, expected)).toBeNull()
  })

  it('drops overflow entries for IDs that are not text layers of the request', () => {
    const body = { ...message, overflow: { T1: true, B1: true, __proto__x: true, other: false } }
    expect(acceptDone(good, body, expected)).toEqual({ T1: true })
  })

  it('gives a plain object with no inherited keys', () => {
    const result = acceptDone(good, message, expected)
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.keys(result ?? {})).toEqual(['T1', 'T2'])
  })
})
