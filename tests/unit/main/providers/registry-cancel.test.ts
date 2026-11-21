import { describe, it, expect } from 'vitest'
import { listProviders } from '@/main/providers/registry'
import { PROVIDER_ERROR_REASONS, type ProviderError } from '@/shared/schemas/queries/app'

describe('ProviderInfo local, cancel and serverText [SPEC 6.11.1, 14 CU-0]', () => {
  it('gives each registered provider the values of the Section 6.11.1 table', () => {
    const rows = listProviders({ ADMAN_FAKE_PROVIDERS: '1' }).map((p) => [
      p.id,
      p.local,
      p.cancel,
      p.serverText,
    ])
    expect(rows).toEqual([
      ['gemini', false, 'none', false],
      ['fal-seedance', false, 'may_finish', false],
      ['comfyui', true, 'stops', true],
      ['firefly', false, 'none', false],
      ['s3', false, 'none', false],
      ['dropbox', false, 'none', false],
      ['azure-blob', false, 'none', false],
      ['jev', false, 'none', false],
      ['fake', true, 'stops', false],
    ])
  })
})

describe('ProviderError reason and missing [SPEC 6.10.9, 6.11.1]', () => {
  it('lists the reasons of Section 6.10.9 once each, in table order', () => {
    expect(PROVIDER_ERROR_REASONS).toEqual([
      'address_needed',
      'no_answer',
      'not_comfyui',
      'sign_in_needed',
      'redirect_refused',
      'certificate',
      'address_refused',
      'missing_items',
      'server_refused',
      'out_of_memory',
      'run_failed',
      'server_stopped',
      'lost_contact',
      'too_long',
      'address_changed',
      'bad_result',
      'clip_has_sound',
    ])
  })

  it('carries an optional reason and list of missing items beside the kind', () => {
    const error: ProviderError = {
      kind: 'other',
      reason: 'missing_items',
      detail: 'two items',
      missing: [
        { what: 'model', name: 'example-model.safetensors', folder: 'checkpoints' },
        { what: 'node', name: 'ExampleNode' },
      ],
    }
    expect(error.missing).toHaveLength(2)
    const plain: ProviderError = { kind: 'offline', detail: 'x' }
    expect(plain.reason).toBeUndefined()
  })
})
