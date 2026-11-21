import { describe, it, expect } from 'vitest'
import { createAppStore } from '@/renderer/stores/app-store'
import { makeFakeApi, baseState } from '../fake-api'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('app store [ADR-003]', () => {
  it('loads app.getState and starts on the start screen', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    expect(store.getState().app?.settings.defaultProjectDir).toBe(
      '/Users/me/Documents/Adman Projects',
    )
    expect(store.getState().view).toEqual({ kind: 'start' })
  })

  it('shows the tab of a project that was just created or opened', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    const project = { projectId: 'P1', name: 'A', filePath: '/w/A.adman' }
    fake.onCommand('project.create', () => ({ ok: true, data: project }))
    fake.setState(baseState({ openProjects: [project] }))
    await store.getState().command('project.create', { name: 'A', location: '/w' })
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it('shows a project opened by the system (double-click) when app.stateChanged arrives', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    store.getState().subscribe()
    await store.getState().refresh()
    fake.setState(
      baseState({ openProjects: [{ projectId: 'P9', name: 'Z', filePath: '/w/Z.adman' }] }),
    )
    fake.emit('app.stateChanged', {})
    await flush()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P9' })
  })

  it('shows the last project already open at first load, as after a double-click launch', async () => {
    const fake = makeFakeApi(
      baseState({
        openProjects: [
          { projectId: 'P1', name: 'A', filePath: '/w/A.adman' },
          { projectId: 'P2', name: 'B', filePath: '/w/B.adman' },
        ],
      }),
    )
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P2' })
  })

  it('returns to the start screen when the shown project closes', async () => {
    const project = { projectId: 'P1', name: 'A', filePath: '/w/A.adman' }
    const fake = makeFakeApi(baseState({ openProjects: [project] }))
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    store.getState().show({ kind: 'project', projectId: 'P1' })
    fake.setState(baseState())
    await store.getState().command('project.close', { projectId: 'P1' })
    expect(store.getState().view).toEqual({ kind: 'start' })
  })

  it('keeps the plain-language message of a failed command', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    fake.onCommand('project.open', () => ({
      ok: false,
      error: {
        code: 'PROJECT_LOCKED',
        message: 'This project is open in another copy of the app.',
      },
    }))
    await store.getState().command('project.open', { filePath: '/w/A.adman' })
    expect(store.getState().error).toBe('This project is open in another copy of the app.')
  })
})

describe('NEEDS_KEY flow [FR-171, SPEC 4.1]', () => {
  it('asks for the provider key, then retries the command once the key is saved', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    let calls = 0
    fake.onCommand('generation.runImages', () =>
      ++calls === 1
        ? {
            ok: false,
            error: {
              code: 'NEEDS_KEY',
              message: 'Add your Gemini key to generate images.',
              details: { provider: 'gemini' },
            },
          }
        : { ok: true, data: 'done' },
    )
    const pending = store.getState().command('generation.runImages', {})
    await flush()
    expect(store.getState().keyRequest?.provider.id).toBe('gemini')
    store.getState().keyRequest?.resolve(true)
    expect(await pending).toEqual({ ok: true, data: 'done' })
    expect(calls).toBe(2)
    expect(store.getState().keyRequest).toBeNull()
  })

  it('gives back the NEEDS_KEY result without retrying when the user cancels', async () => {
    const fake = makeFakeApi()
    const store = createAppStore(fake.api)
    await store.getState().refresh()
    let calls = 0
    fake.onCommand('brief.parse', () => {
      calls++
      return {
        ok: false,
        error: {
          code: 'NEEDS_KEY',
          message: 'Add your Gemini key.',
          details: { provider: 'gemini' },
        },
      }
    })
    const pending = store.getState().command('brief.parse', {})
    await flush()
    store.getState().keyRequest?.resolve(false)
    expect(await pending).toMatchObject({ ok: false, error: { code: 'NEEDS_KEY' } })
    expect(calls).toBe(1)
    expect(store.getState().error).toBeNull()
  })
})
