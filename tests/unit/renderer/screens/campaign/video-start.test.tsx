// SPEC 14 1.60 CU-6b-R N-9, N-10: the "Make a video" card's "Start from" choice. Each start
// sends its row of the start table; a picture start needs one picture; the length's most
// follows the chosen start's workflow.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWith, sent } from './campaign-fixture'
import { ref } from './reference-fixture'
import { PAID_VIDEO } from './video-fixture'
import {
  FIELDS,
  HINT,
  INFO_NO_FRAME,
  type Panel,
  panel,
  pictureApi,
  pictureStart,
  start,
  startFrom,
  view,
} from './video-start-fixture'

const optionLabels = (p: Panel) =>
  within(startFrom(p))
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('VideoPanel "Start from" [SPEC 14 1.60 CU-6b-R N-9]', () => {
  it('offers the three starts, "A prompt" first and chosen', async () => {
    const { p } = await panel()
    expect(optionLabels(p)).toEqual(['A prompt', 'A first-frame picture', 'A reference picture'])
    expect(startFrom(p)).toHaveDisplayValue('A prompt')
    expect(p.queryByRole('region', { name: 'Picture to start from' })).toBeNull()
    expect(p.queryByText(HINT)).toBeNull()
  })

  it('does not offer a start that comfy.getInfo lists no workflow for', async () => {
    const { p } = await panel(pictureApi([ref('A1')], { info: INFO_NO_FRAME }).fake)
    expect(optionLabels(p)).toEqual(['A prompt', 'A reference picture'])
  })

  // P7-22: a provider other than ComfyUI offers the starts of its offer (video-offers.ts).
  it("offers the fal offer's four starts for fal.ai Seedance", async () => {
    const { fake } = pictureApi([ref('A1')], { providers: PAID_VIDEO })
    await renderWith(view, fake)
    const p = within(await screen.findByRole('region', { name: 'Make a video' }))
    expect(optionLabels(p)).toEqual([
      'A prompt',
      "The post's background",
      'A first-frame picture',
      'A reference picture',
    ])
  })

  it('sends a prompt start as start none, no references, no IDs', async () => {
    const { fake, p } = await panel()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo').map((c) => c.input)).toEqual([
      { ...FIELDS, durationMs: 2000, start: 'none', useReferences: false, referenceAssetIds: [] },
    ])
  })

  it('sends a first-frame start as start first_frame with the chosen picture', async () => {
    const { fake, p } = await panel()
    const pictures = await pictureStart(p, 'A first-frame picture')
    await userEvent.click(await pictures.findByRole('radio', { name: 'A2.png' }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo').map((c) => c.input)).toEqual([
      {
        ...FIELDS,
        durationMs: 2000,
        start: 'first_frame',
        useReferences: false,
        referenceAssetIds: ['A2'],
      },
    ])
  })

  it('sends a reference start as start none, useReferences true, with the chosen picture', async () => {
    const { fake, p } = await panel()
    const pictures = await pictureStart(p, 'A reference picture')
    await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo').map((c) => c.input)).toEqual([
      {
        ...FIELDS,
        durationMs: 2000,
        start: 'none',
        useReferences: true,
        referenceAssetIds: ['A1'],
      },
    ])
  })

  it('sends no picture once the start is back to "A prompt"', async () => {
    const { fake, p } = await panel()
    const pictures = await pictureStart(p, 'A first-frame picture')
    await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
    await userEvent.selectOptions(startFrom(p), 'A prompt')
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({
      start: 'none',
      useReferences: false,
      referenceAssetIds: [],
    })
  })

  it('disables Start in a picture start until a picture is chosen', async () => {
    const { p } = await panel()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    const pictures = await pictureStart(p, 'A first-frame picture')
    expect(start(p)).toBeDisabled()
    await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
    expect(start(p)).toBeEnabled()
  })

  it('keeps one choice: a second picture replaces the first', async () => {
    const { fake, p } = await panel()
    const pictures = await pictureStart(p, 'A first-frame picture')
    await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
    await userEvent.click(pictures.getByRole('radio', { name: 'A2.png' }))
    expect(pictures.getByRole('radio', { name: 'A1.png' })).not.toBeChecked()
    expect(pictures.getByRole('radio', { name: 'A2.png' })).toBeChecked()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({
      referenceAssetIds: ['A2'],
    })
  })

  it('keeps its own choice apart from the picture panel ticks', async () => {
    const { p } = await panel()
    const references = within(screen.getByRole('region', { name: 'Reference pictures' }))
    await userEvent.click(await references.findByRole('checkbox', { name: 'A1.png' }))
    const pictures = await pictureStart(p, 'A reference picture')
    expect(await pictures.findByRole('radio', { name: 'A1.png' })).not.toBeChecked()
    expect(start(p)).toBeDisabled()
  })

  it('sets the most from the chosen start, and sends the most for a longer length', async () => {
    const { fake, p } = await panel()
    const length = p.getByLabelText('Length (seconds)')
    const pictures = await pictureStart(p, 'A first-frame picture')
    expect(length).toHaveAttribute('max', '30')
    await userEvent.selectOptions(startFrom(p), 'A reference picture')
    expect(length).toHaveAttribute('max', '10')
    await userEvent.clear(length)
    await userEvent.type(length, '20')
    expect(p.getByText('The clip will be shorter: at most 10 s')).toBeInTheDocument()
    await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({ durationMs: 10_000 })
    await userEvent.selectOptions(startFrom(p), 'A prompt')
    expect(length).toHaveAttribute('max', '15')
  })

  it('shows the hint word for word under a picture start [N-12 5]', async () => {
    const { p } = await panel()
    await pictureStart(p, 'A first-frame picture')
    expect(p.getByText(HINT)).toBeInTheDocument()
    await userEvent.selectOptions(startFrom(p), 'A reference picture')
    expect(p.getByText(HINT)).toBeInTheDocument()
  })
})
