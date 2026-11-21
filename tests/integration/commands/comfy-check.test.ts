import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { comfyCheck } from '@/main/commands/comfy/check'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { NON_DRAFT_WORKFLOWS, withoutDrafts } from '@/main/providers/comfyui/workflows'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { h3TextToVideo } from '@/main/providers/comfyui/workflows/h3'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'

let f: Fixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

const check = () => f.user('comfy.check', {})
const settingsText = () => {
  const file = path.join(f.userData, 'settings.json')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

async function withStandIn(): Promise<StandIn> {
  f = makeFixture()
  stand = await startComfyStandIn()
  data(await f.user('comfy.setAddress', { address: stand.origin }))
  return stand
}

describe('comfy.check [SPEC 4.2, 6.10.3; FR-252]', () => {
  it('checks the saved server and compares no draft workflow, without the address [1.45 B-3]', async () => {
    const s = await withStandIn()
    const before = settingsText()
    const eventsBefore = f.events.length
    const result = data<ComfyCheck>(await check())
    // [1.46] The trial workflows are compared after the version; no draft is.
    expect(NON_DRAFT_WORKFLOWS.map((w) => w.id)).toEqual([
      'moss-text-to-image',
      'h3-text-to-video',
      'h3-image-to-video',
      'h3-reference-to-video',
      'flux3-klein-edit-references',
      'birefnet-cutout',
    ])
    // The stand-in is 0.3.40, lists one model file per folder and knows every node class.
    const model = (folder: string, name: string) => ({ what: 'model', name, folder })
    expect(result).toEqual({
      outcome: 'ok',
      version: '0.3.40',
      workflows: [
        {
          id: 'moss-text-to-image',
          missing: [
            { what: 'version', name: '0.42.0' },
            model('diffusion_models', 'moss_image_sft_int8_convrot.safetensors'),
            model('text_encoders', 'qwen3.5_9b_w4a8_gptq.safetensors'),
            model('vae', 'flux2-vae_small.safetensors'),
          ],
        },
        {
          id: 'h3-text-to-video',
          missing: [
            { what: 'version', name: '0.33.0' },
            model('diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'),
            model('text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'),
            model('vae', 'minimax_h3_video_vae_int8_convrot.safetensors'),
            model('vae', 'minimax_h3_audio_vae_fp32.safetensors'),
          ],
        },
        {
          id: 'h3-image-to-video',
          missing: [
            { what: 'version', name: '0.33.0' },
            model('diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'),
            model('text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'),
            model('vae', 'minimax_h3_video_vae_int8_convrot.safetensors'),
            model('vae', 'minimax_h3_audio_vae_fp32.safetensors'),
          ],
        },
        {
          id: 'h3-reference-to-video',
          missing: [
            { what: 'version', name: '0.33.0' },
            model('diffusion_models', 'minimax_h3_ref2va_pruned_int8_convrot.safetensors'),
            model('text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'),
            model('vae', 'minimax_h3_video_vae_int8_convrot.safetensors'),
            model('vae', 'minimax_h3_audio_vae_fp32.safetensors'),
          ],
        },
        {
          id: 'flux3-klein-edit-references',
          missing: [
            model('diffusion_models', 'flux3-image-klein-base-int8-convrot.safetensors'),
            model('text_encoders', 'qwen3vl_4b_int8_convrot.safetensors'),
            model('vae', 'flux2-vae.safetensors'),
          ],
        },
        {
          id: 'birefnet-cutout',
          missing: [model('background_removal', 'birefnet.safetensors')],
        },
      ],
    })
    const asked = s.seen.map((r) => `${r.method} ${r.path}`)
    expect(asked[0]).toBe('GET /system_stats')
    // Classes and folders that only drafts name are never asked for.
    for (const draftOnly of [
      'TextEncodeQwenImageEditPlus',
      'ImagePadForOutpaint',
      'VAEEncodeForInpaint',
      'EmptyHunyuanLatentVideo',
      '/models/loras',
    ]) {
      expect(
        asked.some((p) => p.includes(draftOnly)),
        draftOnly,
      ).toBe(false)
    }
    const text = JSON.stringify(result)
    expect(text).not.toContain(s.origin)
    expect(text).not.toContain(String(s.port))
    expect(settingsText()).toBe(before)
    expect(f.events.slice(eventsBefore)).not.toContainEqual({
      name: 'app.stateChanged',
      payload: {},
    })
  })

  it('hands the check no draft: none of its folders or node classes is asked for [1.45 N3-1]', async () => {
    const s = await withStandIn()
    const draft: WorkflowSpec = {
      ...mossTextToImage,
      status: 'draft',
      needs: {
        ...mossTextToImage.needs,
        models: [{ folder: 'draft_folder', file: 'd.safetensors' }],
        nodeClasses: ['DraftOnlyNode'],
      },
    }
    const trial: WorkflowSpec = {
      ...h3TextToVideo,
      status: 'trial',
      needs: {
        ...h3TextToVideo.needs,
        models: [{ folder: 'vae', file: 't.safetensors' }],
        nodeClasses: ['TrialOnlyNode'],
      },
    }
    const command = comfyCheck(
      { settings: f.core.settings },
      createServerChecks(),
      withoutDrafts([draft, trial]),
    )
    const { data: result } = (await command.run({ actor: 'user', commandId: 'c1' }, {})) as {
      data: ComfyCheck
    }
    expect(result.outcome).toBe('ok')
    expect(result.workflows.map((w) => w.id)).toEqual([trial.id])
    const paths = s.seen.map((r) => r.path)
    expect(paths).toContain('/object_info/TrialOnlyNode')
    expect(paths.some((p) => p.includes('draft_folder') || p.includes('DraftOnlyNode'))).toBe(false)
  })

  it('sends no prompt, no picture and nothing that changes the server', async () => {
    const s = await withStandIn()
    data(await check())
    for (const r of s.seen) {
      expect(r.method).toBe('GET')
      expect(r.path).toMatch(/^\/(system_stats|models\/|object_info\/)/)
    }
  })

  it('against a server that is not ComfyUI sends exactly one request, GET /system_stats [1.43 N-03]', async () => {
    const s = await withStandIn()
    s.reply('GET /system_stats', {
      body: '<html>a router</html>',
      headers: { 'content-type': 'text/html' },
    })
    expect(data<ComfyCheck>(await check())).toEqual({ outcome: 'not_comfyui', workflows: [] })
    expect(s.seen.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /system_stats'])
  })

  it('asks the server again on each press', async () => {
    const s = await withStandIn()
    data(await check())
    const count = s.seen.length
    data(await check())
    expect(s.seen.length).toBe(count * 2)
  })

  it('gives no_answer when nothing answers at the address', async () => {
    const s = await withStandIn()
    s.reply('GET /system_stats', { vanish: true })
    expect(data<ComfyCheck>(await check())).toEqual({ outcome: 'no_answer', workflows: [] })
  })

  it('refuses with RULE_VIOLATION comfy_address_needed when no address is saved, and sends nothing', async () => {
    f = makeFixture()
    stand = await startComfyStandIn()
    const before = settingsText()
    const result = await check()
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_address_needed' } },
    })
    expect(stand.seen).toEqual([])
    expect(settingsText()).toBe(before)
  })

  it('refuses an input it does not take', async () => {
    f = makeFixture()
    expect(await f.user('comfy.check', { address: 'http://192.168.1.20:8188' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('refuses an agent, and the agent reaches no server', async () => {
    const s = await withStandIn()
    expect(await f.agent('comfy.check', {})).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(s.seen).toEqual([])
  })
})
