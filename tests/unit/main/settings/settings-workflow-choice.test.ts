// CW-5 (spec/comfyui-custom.md, "Which workflow a run gets", the remembered choice): the
// settings key comfyWorkflowChoice, per computer and per kind of job.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSettingsStore } from '@/main/settings/settings-store'
import { defaultSettings } from '@/main/settings/defaults'
import { settingsPatchSchema } from '@/shared/schemas/settings'

let dir: string
let file: string
const defaults = () => defaultSettings(path.join(dir, 'Documents'))
const open = () => createSettingsStore({ file, defaults: defaults() })
const writeWith = (extra: Record<string, unknown>) =>
  fs.writeFileSync(
    file,
    JSON.stringify({ ...defaults(), generation: { optionsPerRun: 2 }, ...extra }),
  )

const PORTRAIT = 'custom-0a1b2c3d4e5f'

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-choice-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('settings.comfyWorkflowChoice [CW-5]', () => {
  it('defaults to an empty object', () => {
    expect(open().get().comfyWorkflowChoice).toEqual({})
  })

  it('loads a good choice as it is', () => {
    writeWith({ comfyWorkflowChoice: { image: PORTRAIT, video_prompt: 'h3-text-to-video' } })
    expect(open().get().comfyWorkflowChoice).toEqual({
      image: PORTRAIT,
      video_prompt: 'h3-text-to-video',
    })
  })

  it.each([
    ['a string', 'custom-0a1b2c3d4e5f'],
    ['a list', [PORTRAIT]],
    ['null', null],
    ['an ID of the wrong form', { image: 'custom-XYZ' }],
    ['a number for an ID', { image: 7 }],
    ['an unknown job key', { cutout: 'birefnet-cutout' }],
  ])('reads %s from the file as {} and keeps the other keys', (_case, value) => {
    writeWith({ comfyWorkflowChoice: value })
    const loaded = open().get()
    expect(loaded.comfyWorkflowChoice).toEqual({})
    expect(loaded.generation).toEqual({ optionsPerRun: 2 })
  })

  it('loads an older file with no key as {}, keeping the other keys', () => {
    const older: Record<string, unknown> = { ...defaults(), generation: { optionsPerRun: 2 } }
    delete older.comfyWorkflowChoice
    fs.writeFileSync(file, JSON.stringify(older))
    const loaded = open().get()
    expect(loaded.comfyWorkflowChoice).toEqual({})
    expect(loaded.generation).toEqual({ optionsPerRun: 2 })
  })

  it('skips __proto__ under the key', () => {
    fs.writeFileSync(file, `{"comfyWorkflowChoice": {"__proto__": {"image": "${PORTRAIT}"}}}`)
    const loaded = open().get().comfyWorkflowChoice
    expect(loaded).toEqual({})
    expect((loaded as Record<string, unknown>).image).toBeUndefined()
    expect(({} as Record<string, unknown>).image).toBeUndefined()
  })

  it('settings.update sets one key, keeps the others, and is kept after a reload', () => {
    const store = open()
    store.update(settingsPatchSchema.parse({ comfyWorkflowChoice: { image: PORTRAIT } }))
    store.update(
      settingsPatchSchema.parse({
        comfyWorkflowChoice: { video_first_frame: 'h3-image-to-video' },
      }),
    )
    expect(open().get().comfyWorkflowChoice).toEqual({
      image: PORTRAIT,
      video_first_frame: 'h3-image-to-video',
    })
  })

  it.each([
    ['an ID of the wrong form', { image: 'custom-0A1B2C3D4E5F' }],
    ['a made-up shipped ID', { image: 'moss-anything' }],
    ['an unknown job key', { cutout: 'birefnet-cutout' }],
    ['a list', [PORTRAIT]],
  ])('settings.update refuses %s', (_name, comfyWorkflowChoice) => {
    expect(settingsPatchSchema.safeParse({ comfyWorkflowChoice }).success).toBe(false)
  })
})
