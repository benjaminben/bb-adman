// CW-5 (spec/comfyui-custom.md, the remembered choice): comfyWorkflowChoice is written only
// by the person's settings.update; an agent is refused, as for every settings.update.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '@/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
const PORTRAIT = 'custom-0a1b2c3d4e5f'

describe('settings.update comfyWorkflowChoice [CW-5]', () => {
  it('starts empty', async () => {
    f = makeFixture()
    expect((await state()).settings.comfyWorkflowChoice).toEqual({})
  })

  it('the person sets it, and it is kept after a restart', async () => {
    f = makeFixture()
    const sent = await f.user('settings.update', { comfyWorkflowChoice: { image: PORTRAIT } })
    expect(sent.ok).toBe(true)
    f.restart()
    expect((await state()).settings.comfyWorkflowChoice).toEqual({ image: PORTRAIT })
  })

  it('an agent is refused with AGENT_DENIED and nothing changes', async () => {
    f = makeFixture()
    const result = await f.agent('settings.update', { comfyWorkflowChoice: { image: PORTRAIT } })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect((await state()).settings.comfyWorkflowChoice).toEqual({})
  })

  it('refuses an ID of the wrong form', async () => {
    f = makeFixture()
    const result = await f.user('settings.update', {
      comfyWorkflowChoice: { image: '../custom-0a1b2c3d4e5f' },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect((await state()).settings.comfyWorkflowChoice).toEqual({})
  })
})
