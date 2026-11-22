// P7-22: the "Make a video" card follows the chosen provider's offer (video-offers.ts): its
// starts, with "The post's background" new, its length bounds with the default max(2 s, min),
// up to its reference count, and for an image post the line "Change this post to video first."
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { P, sent } from './campaign-fixture'
import {
  ALL_STARTS,
  IMAGE_LINE,
  WITH_FAL,
  optionLabels,
  postApi,
  postPanel,
  type PostPanel,
} from './video-offer-fixture'

const start = (p: PostPanel) => p.getByRole('button', { name: 'Start' })
const length = (p: PostPanel) => p.getByLabelText('Length (seconds)')
const FIELDS = { projectId: P, variantId: 'V1', prompt: 'A can', provider: 'fake' }

async function chooseFal(p: PostPanel, id = 'fal-seedance') {
  await userEvent.selectOptions(p.getByLabelText('Provider'), id)
}

describe('"Make a video" offers [P7-22]', () => {
  it.each([
    ['the fake provider', 'fake', '1', '120', 2],
    ['a stand-in fal offer', 'fal-seedance', '4', '15', 4],
  ])('offers the four starts and the length bounds of %s', async (_n, id, min, max, value) => {
    const { p } = await postPanel(postApi({ providers: WITH_FAL }))
    await chooseFal(p, id)
    expect(optionLabels(p)).toEqual(ALL_STARTS)
    expect(length(p)).toHaveAttribute('min', min)
    expect(length(p)).toHaveAttribute('max', max)
    expect(length(p)).toHaveAttribute('step', '1')
    expect(length(p)).toHaveValue(value)
  })

  it('chooses "The post\'s background" when the background has a picture, with no picture list', async () => {
    const { fake, p } = await postPanel()
    await waitFor(() => expect(p.getByLabelText('Start from')).toHaveDisplayValue(ALL_STARTS[1]!))
    expect(p.queryByRole('region', { name: 'Picture to start from' })).toBeNull()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo').map((c) => c.input)).toEqual([
      {
        ...FIELDS,
        durationMs: 2000,
        start: 'background',
        useReferences: false,
        referenceAssetIds: [],
      },
    ])
  })

  it('starts from "A prompt" when the background has no picture', async () => {
    const { p } = await postPanel(postApi({ picture: false }))
    await waitFor(() => expect(optionLabels(p)).toEqual(ALL_STARTS))
    expect(p.getByLabelText('Start from')).toHaveDisplayValue('A prompt')
  })

  it('shows the line and disables Start for an image post', async () => {
    const { fake, p } = await postPanel(postApi({ format: 'image' }))
    expect(await p.findByText(IMAGE_LINE)).toBeInTheDocument()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    expect(start(p)).toBeDisabled()
    expect(sent(fake, 'generation.startVideo')).toEqual([])
  })

  it('shows no image line for a video post', async () => {
    const { p } = await postPanel()
    await waitFor(() => expect(p.getByLabelText('Start from')).toHaveDisplayValue(ALL_STARTS[1]!))
    expect(p.queryByText(IMAGE_LINE)).toBeNull()
  })

  it("takes up to the offer's reference count, and sends each chosen picture", async () => {
    const { fake, p } = await postPanel(postApi({ pictures: 5 }))
    await userEvent.selectOptions(p.getByLabelText('Start from'), 'A reference picture')
    const list = within(await p.findByRole('region', { name: 'Picture to start from' }))
    const boxes = await list.findAllByRole('checkbox')
    expect(boxes).toHaveLength(5)
    for (const box of boxes.slice(0, 4)) await userEvent.click(box)
    expect(boxes[4]).toBeDisabled()
    await userEvent.click(boxes[0]!)
    expect(boxes[4]).toBeEnabled()
    await userEvent.click(boxes[4]!)
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({
      start: 'none',
      useReferences: true,
      referenceAssetIds: ['A2', 'A3', 'A4', 'A5'],
    })
  })

  it('keeps one picture for a first-frame start, and sends only it', async () => {
    const { fake, p } = await postPanel(postApi({ pictures: 3 }))
    await userEvent.selectOptions(p.getByLabelText('Start from'), 'A reference picture')
    const refs = within(await p.findByRole('region', { name: 'Picture to start from' }))
    for (const box of await refs.findAllByRole('checkbox')) await userEvent.click(box)
    await userEvent.selectOptions(p.getByLabelText('Start from'), 'A first-frame picture')
    const frame = within(await p.findByRole('region', { name: 'Picture to start from' }))
    const radios = await frame.findAllByRole('radio')
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({
      start: 'first_frame',
      useReferences: false,
      referenceAssetIds: ['A1'],
    })
  })

  it("notes a length above the offer's most and sends the most", async () => {
    const { fake, p } = await postPanel(postApi({ providers: WITH_FAL }))
    await chooseFal(p)
    await userEvent.clear(length(p))
    await userEvent.type(length(p), '20')
    expect(p.getByText('The clip will be shorter: at most 15 s')).toBeInTheDocument()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    await userEvent.click(p.getByRole('button', { name: 'Confirm' }))
    expect(sent(fake, 'generation.startVideo')[0]?.input).toMatchObject({ durationMs: 15_000 })
  })

  it('asks first on fal and sends nothing on Cancel; the fake provider shows no paid line', async () => {
    const { fake, p } = await postPanel(postApi({ providers: WITH_FAL }))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await chooseFal(p)
    await userEvent.click(start(p))
    // The default start is the post's background, which sends one picture.
    expect(
      p.getByText('This sends 1 paid request(s) and 1 reference picture(s) to fal.ai Seedance.'),
    ).toBeInTheDocument()
    await userEvent.click(p.getByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'generation.startVideo')).toEqual([])
    await userEvent.selectOptions(p.getByLabelText('Provider'), 'fake')
    await userEvent.click(start(p))
    expect(p.queryByText(/paid request/)).toBeNull()
    expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
  })

  it('shows a refusal of the background start as its own sentence', async () => {
    const fake = postApi()
    const message = 'This post has no background picture yet. Add one, or start from a prompt.'
    fake.onCommand('generation.startVideo', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'background_empty' } },
    }))
    const { p } = await postPanel(fake)
    await waitFor(() => expect(p.getByLabelText('Start from')).toHaveDisplayValue(ALL_STARTS[1]!))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  // P7-15b: the paid line counts the pictures the start sends to the provider.
  it('names the reference pictures a paid start sends', async () => {
    const { p } = await postPanel(postApi({ pictures: 3, providers: WITH_FAL }))
    await chooseFal(p)
    await userEvent.selectOptions(p.getByLabelText('Start from'), 'A reference picture')
    const list = within(await p.findByRole('region', { name: 'Picture to start from' }))
    const boxes = await list.findAllByRole('checkbox')
    for (const box of boxes.slice(0, 2)) await userEvent.click(box)
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(
      p.getByText('This sends 1 paid request(s) and 2 reference picture(s) to fal.ai Seedance.'),
    ).toBeInTheDocument()
  })

  // A background start sends the post's background picture, so the line counts one picture.
  it('counts the background picture a paid background start sends', async () => {
    const { p } = await postPanel(postApi({ providers: WITH_FAL }))
    await chooseFal(p)
    await waitFor(() => expect(p.getByLabelText('Start from')).toHaveDisplayValue(ALL_STARTS[1]!))
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    await userEvent.click(start(p))
    expect(
      p.getByText('This sends 1 paid request(s) and 1 reference picture(s) to fal.ai Seedance.'),
    ).toBeInTheDocument()
  })
})
