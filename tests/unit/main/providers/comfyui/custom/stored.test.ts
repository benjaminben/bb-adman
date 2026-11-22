import { describe, it, expect } from 'vitest'
import { readStoredWorkflow } from '@/main/providers/comfyui/custom/stored'
import { CUSTOM_SIZE_DEFAULTS } from '@/shared/comfy/custom-workflow'
import { storedFrom } from './stored'

const SIZE = CUSTOM_SIZE_DEFAULTS.image

describe('readStoredWorkflow: the stored shape [D-104]', () => {
  it('reads back a good stored file, with its checked graph', () => {
    const stored = storedFrom('picture', { size: SIZE })
    const read = readStoredWorkflow(JSON.parse(JSON.stringify(stored)))
    expect(read?.stored).toEqual(stored)
    expect(read?.checked.job).toBe('image')
  })

  it('reads a video file with its video values', () => {
    const stored = storedFrom('video-refs')
    expect(readStoredWorkflow(stored)?.stored.video).toEqual(stored.video)
  })

  it.each([
    ['another format', { format: 2 }],
    ['a shipped ID', { id: 'moss-text-to-image' }],
    ['an ID that is not the form', { id: 'custom-../../x' }],
    ['an empty name', { name: '' }],
    ['a name of spaces', { name: '   ' }],
    ['a name of 61 characters', { name: 'n'.repeat(61) }],
    ['a name with a control character', { name: 'a\u0000b' }],
    ['a name with a format character', { name: `a${String.fromCharCode(0x202e)}b` }],
    ['a name with a line break', { name: 'a\nb' }],
    ['another adder', { addedBy: 'server' }],
    ['a date that is not ISO 8601', { addedAt: 'yesterday' }],
    ['a size that is not an option', { size: { multiple: 16, minPixels: 1, maxPixels: 9 } }],
    ['a size for a graph with no size marks', { graph: storedFrom('two-refs').graph }],
    [
      'video values for a picture graph',
      { video: { fps: 24, maxMs: 5_000, frameStep: 4, frameOffset: 1 } },
    ],
    ['a graph that fails the file checks', { graph: { a: { class_type: 'X', inputs: {} } } }],
    ['an extra field', { path: '/tmp/x.json' }],
  ])('refuses %s', (_, extra) => {
    expect(readStoredWorkflow({ ...storedFrom('picture', { size: SIZE }), ...extra })).toBeNull()
  })

  it('refuses a size missing where the graph has size marks', () => {
    expect(readStoredWorkflow(storedFrom('picture'))).toBeNull()
  })

  it('refuses a video graph without video values, or with values out of range', () => {
    expect(readStoredWorkflow(storedFrom('video-refs', { video: null }))).toBeNull()
    const fast = { fps: 61, maxMs: 5_000, frameStep: 4, frameOffset: 1 }
    expect(readStoredWorkflow(storedFrom('video-refs', { video: fast }))).toBeNull()
  })

  it('refuses a graph with a __proto__ node or input name, not silently changed', () => {
    const good = JSON.stringify(storedFrom('picture', { size: SIZE }))
    const asNode = good.replace('"graph":{', '"graph":{"__proto__":{"class_type":"X","inputs":{}},')
    const asInput = good.replace('"text":', '"__proto__":1,"text":')
    for (const text of [asNode, asInput]) {
      expect(text).toContain('"__proto__"')
      expect(readStoredWorkflow(JSON.parse(text))).toBeNull()
    }
  })

  it('refuses a value that is not an object', () => {
    expect(readStoredWorkflow(null)).toBeNull()
    expect(readStoredWorkflow('text')).toBeNull()
  })

  it('accepts a name of 60 characters with letters from any script', () => {
    const name = 'Ünïcode 写真 '.padEnd(60, 'x')
    expect(readStoredWorkflow(storedFrom('picture', { size: SIZE, name }))?.stored.name).toBe(name)
  })
})
