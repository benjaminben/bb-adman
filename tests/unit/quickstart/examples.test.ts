import { describe, expect, it } from 'vitest'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseBrief, listExamples } from '../../../quickstart/examples'

const ROOT = join('home', 'quickstart', 'examples')

describe('quickstart chooseBrief', () => {
  it("takes the named example's brief.yaml", () => {
    expect(
      chooseBrief({ brief: null, example: 'summer-splash' }, ROOT, [
        'simple-routine',
        'summer-splash',
      ]),
    ).toEqual({
      ok: true,
      path: join(ROOT, 'summer-splash', 'brief.yaml'),
    })
  })

  it('lets --brief win over --example', () => {
    const chosen = chooseBrief({ brief: 'mine.yaml', example: 'nowhere' }, ROOT, [])
    expect(chosen).toEqual({ ok: true, path: resolve('mine.yaml') })
  })

  it('refuses an example with no folder and lists the examples found', () => {
    const chosen = chooseBrief({ brief: null, example: 'nowhere' }, ROOT, ['a-one', 'b-two'])
    expect(chosen.ok).toBe(false)
    expect(!chosen.ok && chosen.message).toBe(
      'There is no example "nowhere". The examples are: a-one, b-two.',
    )
  })
})

describe('quickstart listExamples', () => {
  it('finds the two examples the quickstart ships with, in name order', async () => {
    const here = new URL('../../../quickstart/examples', import.meta.url)
    expect(await listExamples(fileURLToPath(here))).toEqual(['simple-routine', 'summer-splash'])
  })
})
