import { describe, it, expect } from 'vitest'
import { createProjectStore } from '../../../../src/renderer/stores/project-store'
import { makeFakeApi } from '../fake-api'

describe('project store, one per tab [ADR-003, SPEC 3.6]', () => {
  it('applies changed and removed rows from project.changed for its own project only', () => {
    const fake = makeFakeApi()
    const store = createProjectStore(fake.api, 'P1')
    const stop = store.getState().subscribe()
    fake.emit('project.changed', {
      projectId: 'P1',
      changed: {
        subject: [
          { id: 's1', name: 'Shoe' },
          { id: 's2', name: 'Bag' },
        ],
      },
      removed: {},
      actor: 'agent',
    })
    fake.emit('project.changed', {
      projectId: 'P2',
      changed: { subject: [{ id: 'x', name: 'Other' }] },
      removed: {},
      actor: 'user',
    })
    fake.emit('project.changed', {
      projectId: 'P1',
      changed: { subject: [{ id: 's1', name: 'Boot' }] },
      removed: { subject: ['s2'] },
      actor: 'user',
    })
    expect(store.getState().tables.subject).toEqual({ s1: { id: 's1', name: 'Boot' } })
    expect(store.getState().lastActor).toBe('user')
    stop()
  })

  it('keys project_meta rows by their key column', () => {
    const fake = makeFakeApi()
    const store = createProjectStore(fake.api, 'P1')
    store.getState().subscribe()
    fake.emit('project.changed', {
      projectId: 'P1',
      changed: { project_meta: [{ key: 'name', value: 'A' }] },
      removed: {},
      actor: 'user',
    })
    expect(store.getState().tables.project_meta).toEqual({ name: { key: 'name', value: 'A' } })
  })
})
