// spec/phases/round-2-platform.md, D9 window side: the app store shows a project only on the
// window's own open or create, on app.showProject, and on the first state read (the newest
// open one). A project that only appears in the state, as one an agent made, is listed.
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/renderer/stores/app-store'
import { baseState, makeFakeApi } from '../fake-api'

const flush = () => new Promise((r) => setTimeout(r, 0))

const SPRING = { projectId: 'P1', name: 'Spring Launch', filePath: '/w/Spring Launch.adman' }
const HARBOUR = { projectId: 'P2', name: 'Harbour Lights', filePath: '/w/Harbour Lights.adman' }

async function shownSpring() {
  const fake = makeFakeApi(baseState({ openProjects: [SPRING] }))
  const store = createAppStore(fake.api)
  store.getState().subscribe()
  await store.getState().refresh()
  return { fake, store }
}

describe('which project the window shows [R2P-10, D9]', () => {
  it('lists a project that appears through an agent without showing it', async () => {
    const { fake, store } = await shownSpring()
    fake.setState(baseState({ openProjects: [SPRING, HARBOUR] }))
    fake.emit('app.stateChanged', {})
    await flush()
    expect(store.getState().app?.openProjects.map((p) => p.projectId)).toEqual(['P1', 'P2'])
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it('shows the project app.showProject names, once the state lists it', async () => {
    const { fake, store } = await shownSpring()
    fake.setState(baseState({ openProjects: [SPRING, HARBOUR] }))
    fake.emit('app.showProject', { projectId: 'P2' })
    await flush()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
  })

  it('shows an already open project when app.showProject names it', async () => {
    const fake = makeFakeApi(baseState({ openProjects: [SPRING, HARBOUR] }))
    const store = createAppStore(fake.api)
    store.getState().subscribe()
    await store.getState().refresh()
    store.getState().show({ kind: 'start' })
    fake.emit('app.showProject', { projectId: 'P1' })
    await flush()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it('ignores app.showProject for a project that is not open', async () => {
    const { fake, store } = await shownSpring()
    fake.emit('app.showProject', { projectId: 'P9' })
    await flush()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it('shows the newest open project on the first state read', async () => {
    const fake = makeFakeApi(baseState({ openProjects: [SPRING, HARBOUR] }))
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
  })

  it.each(['project.open', 'project.create'])(
    "shows the project the window's own %s returns, the first staying open",
    async (name) => {
      const { fake, store } = await shownSpring()
      fake.onCommand(name, () => ({ ok: true, data: HARBOUR }))
      fake.setState(baseState({ openProjects: [SPRING, HARBOUR] }))
      await store.getState().command(name, {})
      expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
      expect(store.getState().app?.openProjects).toHaveLength(2)
    },
  )

  it('stops listening for app.showProject when unsubscribed', async () => {
    const fake = makeFakeApi(baseState({ openProjects: [SPRING, HARBOUR] }))
    const store = createAppStore(fake.api)
    const stop = store.getState().subscribe()
    await store.getState().refresh()
    stop()
    fake.emit('app.showProject', { projectId: 'P1' })
    await flush()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
  })
})
