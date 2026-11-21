// spec/scene.md, "The render service": one draw at a time for the whole app; a variant.render
// goes first, thumbnails after, oldest first, merged by project and variant.
import { describe, it, expect } from 'vitest'
import { createDrawQueue } from '@/main/thumbnails/queue'

function gate() {
  let open = (): void => {}
  const done = new Promise<void>((resolve) => (open = resolve))
  return { done, open }
}

describe('draw queue [spec/scene.md, The render service]', () => {
  it('runs one draw at a time: render first, then thumbnails oldest first, merged', async () => {
    const queue = createDrawQueue()
    const order: string[] = []
    const first = gate()
    queue.thumbnail('p1', 'v1', async () => {
      order.push('t1')
      await first.done
    })
    queue.thumbnail('p1', 'v2', async () => void order.push('t2'))
    queue.thumbnail('p1', 'v3', async () => void order.push('t3'))
    queue.thumbnail('p1', 'v2', async () => void order.push('t2 again'))
    const render = queue.render(async () => {
      order.push('render')
      return 7
    })
    expect(order).toEqual(['t1'])
    first.open()
    expect(await render).toBe(7)
    await queue.idle()
    expect(order).toEqual(['t1', 'render', 't2', 't3'])
  })

  it('queues a thumbnail again when the same one is already drawing', async () => {
    const queue = createDrawQueue()
    const order: string[] = []
    const first = gate()
    queue.thumbnail('p1', 'v1', async () => {
      order.push('a')
      await first.done
    })
    queue.thumbnail('p1', 'v1', async () => void order.push('b'))
    first.open()
    await queue.idle()
    expect(order).toEqual(['a', 'b'])
  })

  it('drops one waiting thumbnail, or every waiting thumbnail of a project', async () => {
    const queue = createDrawQueue()
    const order: string[] = []
    const first = gate()
    queue.thumbnail('p0', 'v0', async () => {
      await first.done
    })
    queue.thumbnail('p1', 'v1', async () => void order.push('p1v1'))
    queue.thumbnail('p1', 'v2', async () => void order.push('p1v2'))
    queue.thumbnail('p2', 'v1', async () => void order.push('p2v1'))
    queue.thumbnail('p2', 'v2', async () => void order.push('p2v2'))
    queue.dropProject('p1')
    queue.drop('p2', 'v1')
    first.open()
    await queue.idle()
    expect(order).toEqual(['p2v2'])
  })

  it('goes on after a draw that throws, and the render promise rejects', async () => {
    const queue = createDrawQueue()
    const order: string[] = []
    queue.thumbnail('p1', 'v1', async () => {
      throw new Error('boom')
    })
    const render = queue.render(async () => {
      throw new Error('no')
    })
    queue.thumbnail('p1', 'v2', async () => void order.push('v2'))
    await expect(render).rejects.toThrow('no')
    await queue.idle()
    expect(order).toEqual(['v2'])
  })
})
