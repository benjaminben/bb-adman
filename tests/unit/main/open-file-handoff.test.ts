import { describe, expect, it } from 'vitest'
import { handoffPaths } from '@/main/open-file'

// spec/phases/round-2-platform.md D9 (R2P-9): what a second launch hands over is untrusted
// text from another process. Only a plain object whose own `paths` is a list of at most 20
// absolute project paths gives anything; a refused item is dropped.
const mac = (data: unknown) => handoffPaths(data, 'darwin')
const win = (data: unknown) => handoffPaths(data, 'win32')

describe('handoffPaths [R2P-9, D9]', () => {
  it('keeps a good list of absolute project paths', () => {
    const paths = ['/Users/a/Spring.adman', '/Volumes/Work/Summer Sale.ADMAN']
    expect(mac({ paths })).toEqual(paths)
    expect(win({ paths: ['C:\\Users\\a\\Spring.adman', 'D:/Work/B.adman'] })).toEqual([
      'C:\\Users\\a\\Spring.adman',
      'D:/Work/B.adman',
    ])
  })

  it('gives nothing for a list of more than 20', () => {
    const paths = Array.from({ length: 21 }, (_, i) => `/Users/a/P${i}.adman`)
    expect(mac({ paths })).toEqual([])
    expect(mac({ paths: paths.slice(0, 20) })).toHaveLength(20)
  })

  it.each([
    ['a relative path', 'Spring.adman'],
    ['a dot path', './Spring.adman'],
    ['a parent path', '../a/Spring.adman'],
    ['another extension', '/Users/a/Spring.txt'],
    ['an extension inside the name', '/Users/a/Spring.adman.zip'],
    ['an option', '-Spring.adman'],
    ['an empty text', ''],
  ])('drops %s', (_why, bad) => {
    expect(mac({ paths: [bad, '/Users/a/Good.adman'] })).toEqual(['/Users/a/Good.adman'])
  })

  it.each([
    ['a network path', '\\\\server\\share\\P.adman'],
    ['a forward network path', '//server/share/P.adman'],
    ['a device path', '\\\\?\\C:\\P.adman'],
    ['a mixed network path', '\\/server/P.adman'],
    ['a drive-relative path', 'C:P.adman'],
    ['a root-relative path', '\\Users\\P.adman'],
  ])('on Windows drops %s', (_why, bad) => {
    expect(win({ paths: [bad, 'C:\\a\\Good.adman'] })).toEqual(['C:\\a\\Good.adman'])
  })

  it('drops items that are not plain text', () => {
    const paths = [1, null, { toString: () => '/a/B.adman' }, ['/a/C.adman'], '/a/D.adman']
    expect(mac({ paths })).toEqual(['/a/D.adman'])
  })

  it.each([
    ['no data', undefined],
    ['null', null],
    ['a text', '/a/B.adman'],
    ['a list', ['/a/B.adman']],
    ['paths as a text', { paths: '/a/B.adman' }],
    ['paths as an object', { paths: { 0: '/a/B.adman', length: 1 } }],
    ['no paths', { other: ['/a/B.adman'] }],
  ])('gives nothing for %s', (_why, data) => {
    expect(mac(data)).toEqual([])
  })

  it('ignores paths that come only from the prototype', () => {
    const inherited = Object.create({ paths: ['/a/B.adman'] }) as object
    expect(mac(inherited)).toEqual([])
    expect(mac({ __proto__: { paths: ['/a/B.adman'] } })).toEqual([])
  })

  it('reads an own __proto__ key as just another key', () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"paths": ["/a/B.adman"]}}')
    expect(mac(parsed)).toEqual([])
    const both: unknown = JSON.parse('{"__proto__": 1, "paths": ["/a/B.adman"]}')
    expect(mac(both)).toEqual(['/a/B.adman'])
  })
})
