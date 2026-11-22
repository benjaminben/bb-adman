// DLG-1 (spec/phases/design-wave-screens-b.md): real plurals in place of "(s)". The number is
// printed as given; the word is the one form or the many form.
import { describe, expect, it } from 'vitest'
import { plural } from '@/renderer/ui/plural'

describe('plural [DLG-1]', () => {
  it.each([
    [0, 'picture', '0 pictures'],
    [1, 'picture', '1 picture'],
    [2, 'picture', '2 pictures'],
    [1, 'video', '1 video'],
    [3, 'video', '3 videos'],
    [1, 'variant', '1 variant'],
    [12, 'variant', '12 variants'],
    [1, 'photo', '1 photo'],
    [5, 'photo', '5 photos'],
    [0, 'file', '0 files'],
    [1, 'file', '1 file'],
    [2, 'file', '2 files'],
    [1, 'generation', '1 generation'],
    [40, 'generation', '40 generations'],
    [1, 'request', '1 request'],
    [7, 'request', '7 requests'],
    [1, 'reference', '1 reference'],
    [2, 'reference', '2 references'],
    [1, 'project', '1 project'],
    [100, 'project', '100 projects'],
    [1, 'post', '1 post'],
    [1250, 'post', '1250 posts'],
  ])('%i %s gives "%s"', (n, one, expected) => {
    expect(plural(n, one)).toBe(expected)
  })

  it.each([
    [0, 'copy', 'copies', '0 copies'],
    [1, 'copy', 'copies', '1 copy'],
    [2, 'copy', 'copies', '2 copies'],
    [1, 'person', 'people', '1 person'],
    [3, 'person', 'people', '3 people'],
  ])('%i %s with the many form "%s" gives "%s"', (n, one, many, expected) => {
    expect(plural(n, one, many)).toBe(expected)
  })

  it('never changes the number it is given', () => {
    expect(plural(-1, 'file')).toBe('-1 files')
    expect(plural(1.5, 'file')).toBe('1.5 files')
  })
})
