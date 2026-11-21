import { describe, it, expect } from 'vitest'
import { settingsPatchSchema, settingsSchema } from '../../../../src/shared/schemas/settings'
import { defaultSettings } from '../../../../src/main/settings/defaults'

const defaults = defaultSettings('/docs')

describe('settings keys comfyui and agentRuns [SPEC 13.1 1.24, 14 CU-0]', () => {
  it('defaults to no ComfyUI address and no ticks', () => {
    expect(defaults.comfyui).toEqual({ baseUrl: null })
    expect(defaults.agentRuns).toEqual({})
  })

  it('accepts a stored address and a tick per provider', () => {
    const next = {
      ...defaults,
      comfyui: { baseUrl: 'http://192.0.2.10:8188' },
      agentRuns: { comfyui: { allowed: true }, fake: { allowed: false } },
    }
    expect(settingsSchema.safeParse(next).success).toBe(true)
  })

  it('refuses a settings object without either key', () => {
    const noComfy: Record<string, unknown> = { ...defaults }
    const noTicks: Record<string, unknown> = { ...defaults }
    delete noComfy.comfyui
    delete noTicks.agentRuns
    expect(settingsSchema.safeParse(noComfy).success).toBe(false)
    expect(settingsSchema.safeParse(noTicks).success).toBe(false)
  })

  it('refuses a tick that is not a boolean, and an address that is not text or null', () => {
    const badTick = { ...defaults, agentRuns: { comfyui: { allowed: 'yes' } } }
    const badAddress = { ...defaults, comfyui: { baseUrl: 8188 } }
    expect(settingsSchema.safeParse(badTick).success).toBe(false)
    expect(settingsSchema.safeParse(badAddress).success).toBe(false)
  })

  it('keeps both keys out of the settings.update input', () => {
    const address = { comfyui: { baseUrl: 'http://192.0.2.10:8188' } }
    const tick = { agentRuns: { comfyui: { allowed: true } } }
    expect(settingsPatchSchema.safeParse(address).success).toBe(false)
    expect(settingsPatchSchema.safeParse(tick).success).toBe(false)
  })
})
