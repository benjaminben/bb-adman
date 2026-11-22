// Answers for the "Make a video" card's offer tests (P7-22): the fake video provider, the fal
// Seedance row switched on as a stand-in offer, and a variant.get reply for V1 with a chosen
// format and a background layer with or without a picture.
import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { BACKGROUND, variantGet } from '../../editor/editor-fixture'
import { renderWith } from './campaign-fixture'
import { ref } from './reference-fixture'
import { PAID_VIDEO } from './video-fixture'
import { pictureApi, view } from './video-start-fixture'

export const FAKE_VIDEO: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}

// fal.ai Seedance on (a stand-in: the real row stays off), after the fake provider.
export const WITH_FAL: ProviderInfo[] = [FAKE_VIDEO, ...PAID_VIDEO]

type PostOpts = {
  format?: VariantRow['format']
  picture?: boolean
  providers?: ProviderInfo[]
  pictures?: number
}

export function postApi(opts: PostOpts = {}) {
  const rows = Array.from({ length: opts.pictures ?? 2 }, (_, i) => ref(`A${i + 1}`))
  const { fake } = pictureApi(rows, { providers: opts.providers ?? [FAKE_VIDEO] })
  const base = variantGet()
  const background = { ...BACKGROUND, source: opts.picture === false ? null : { assetId: 'A9' } }
  const reply: VariantGet = {
    ...base,
    variant: { ...base.variant, format: opts.format ?? 'video' },
    layers: [background],
    assets: [],
  }
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  return fake
}

// The card once variant.get has answered (the start's options are in).
export async function postPanel(fake = postApi()) {
  await renderWith(view, fake)
  const p = within(await screen.findByRole('region', { name: 'Make a video' }))
  await waitFor(() => expect(fake.queries.some((q) => q.name === 'variant.get')).toBe(true))
  return { fake, p }
}

export type PostPanel = Awaited<ReturnType<typeof postPanel>>['p']

export const optionLabels = (p: PostPanel) =>
  within(p.getByLabelText('Start from'))
    .getAllByRole('option')
    .map((o) => o.textContent)

export const ALL_STARTS = [
  'A prompt',
  "The post's background",
  'A first-frame picture',
  'A reference picture',
]

export const IMAGE_LINE = 'Change this post to video first.'
