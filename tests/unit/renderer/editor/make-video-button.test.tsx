// R2E-11 (spec/phases/round-2-editor.md D7): on a video post the timeline's clip track has
// "Make a video…" beside "Add clip…". It selects the background layer, chooses "Video" in the
// Generate panel and puts the focus on "Prompt"; it starts nothing. With no layer selected, the
// properties panel of a video post says where videos are made.
import '../../shared/scene/fake-fonts'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { FAKE_VIDEO } from '../screens/campaign/video-offer-fixture'
import { INFO_ALL } from '../screens/campaign/video-start-fixture'
import { assetRow, BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

const MAKE = 'Make a video…'
const EMPTY = 'Select a layer to change it.'
const EMPTY_VIDEO = 'Select a layer to change it. To make a video, select the background layer.'

function videoGet(): VariantGet {
  const base = variantGet({ layers: [BACKGROUND, HEADLINE, LOGO] })
  return { ...base, variant: { ...base.variant, format: 'video', durationMs: 8000 } }
}

async function open(reply: VariantGet) {
  const fake = campaignApi({ state: { providers: [FAKE_VIDEO] } })
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  fake.onQuery('asset.list', () => ({ ok: true, data: [assetRow('A1')] }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO_ALL }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  await screen.findByRole('region', { name: 'Canvas, Master post' })
  return fake
}

const properties = () => within(screen.getByRole('region', { name: 'Properties' }))
const pressed = (name: string) =>
  within(screen.getByRole('group', { name: 'Make' }))
    .getByRole('button', { name })
    .getAttribute('aria-pressed')

async function makeVideo() {
  const timeline = within(screen.getByRole('region', { name: 'Timeline' }))
  await userEvent.click(timeline.getByRole('button', { name: MAKE }))
  await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveFocus())
}

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

describe('"Make a video…" on the timeline [R2E-11, D7]', () => {
  it('is not there on an image post', async () => {
    await open(variantGet({ layers: [BACKGROUND, HEADLINE, LOGO] }))
    expect(screen.queryByRole('button', { name: MAKE })).toBeNull()
  })

  it('selects the background, chooses "Video" and puts the focus on "Prompt"', async () => {
    const fake = await open(videoGet())
    await makeVideo()
    expect(properties().getByRole('heading', { name: BACKGROUND.name })).toBeInTheDocument()
    expect(pressed('Video')).toBe('true')
    expect(fake.commands.filter((c) => c.name.startsWith('generation.'))).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('switches a draft that exists to video', async () => {
    const draft = { prompt: 'A picture of a can', referenceAssetIds: [], run: null }
    generateDrafts.setState({ drafts: { [`${P}/${BACKGROUND.id}`]: { ...draft, kind: 'image' } } })
    await open(videoGet())
    await makeVideo()
    expect(pressed('Video')).toBe('true')
    expect(screen.getByLabelText('Prompt')).toHaveValue('A video of a can')
  })

  it('moves the focus again when the background is already selected', async () => {
    await open(videoGet())
    await makeVideo()
    await userEvent.click(within(screen.getByRole('group', { name: 'Make' })).getByText('Picture'))
    expect(pressed('Picture')).toBe('true')
    await makeVideo()
    expect(pressed('Video')).toBe('true')
  })
})

describe('the empty properties line [R2E-11, D7]', () => {
  it('on a video post, says where videos are made', async () => {
    await open(videoGet())
    expect(properties().getByText(EMPTY_VIDEO)).toBeInTheDocument()
  })

  it('on an image post, keeps the plain line', async () => {
    await open(variantGet({ layers: [BACKGROUND, HEADLINE, LOGO] }))
    expect(properties().getByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByText(EMPTY_VIDEO)).toBeNull()
  })
})
