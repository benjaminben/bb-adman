// R2E-8 (spec/phases/round-2-editor.md D4, the video parts): the "Make" switch on a video
// post's background, the video starts of the available providers, "Clip length (seconds)",
// and what generation.startVideo is sent after the run dialog's own Generate. Ported from the
// "Make a video" card's offer and start tests (video-offer, video-start) so their cases hold.
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { baseState } from '../fake-api'
import { costLine } from '../cost-line'
import { ref } from '../screens/campaign/reference-fixture'
import { CLIP, videoRow } from '../screens/campaign/video-fixture'
import { assetRow, BACKGROUND, LOGO, P } from './editor-fixture'
import {
  A1,
  ALL_VIDEO_STARTS,
  COMFY,
  FAL,
  INFO_NO_FRAME,
  WITH_FAL,
  chooseStart,
  clipLength,
  generateButton,
  generateVideo,
  makeGroup,
  openDialog,
  openVideo,
  startLabels,
  starts,
  videoInputs,
} from './generate-panel-video-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

const FIELDS = { projectId: P, variantId: 'V1', prompt: 'A can', provider: 'fake', layerId: 'L0' }
const NONE = { start: 'none', useReferences: false, referenceAssetIds: [] }
// ED-4a: a start choice is a tile button with aria-pressed.
const startRadio = (name: string) => starts().getByRole('button', { name })
const ON_TIMELINE = 'On a video post, the clips on the timeline show over this picture.'

async function typePrompt(text = 'A can') {
  await userEvent.clear(screen.getByLabelText('Prompt'))
  await userEvent.type(screen.getByLabelText('Prompt'), text)
}

describe('the "Make" switch [R2E-8, D4]', () => {
  it('chooses "Video" first on a video post\'s background, with the clip length', async () => {
    const { panel } = await openVideo()
    expect(makeGroup().getByRole('button', { name: 'Video' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(makeGroup().getByRole('button', { name: 'Picture' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(clipLength()).toHaveValue(2)
    expect(clipLength()).toHaveAttribute('min', '1')
    expect(panel.queryByText(ON_TIMELINE)).toBeNull()
    expect(panel.queryByRole('button', { name: 'Choose reference pictures…' })).toBeNull()
  })

  it('chooses "Video" for a draft made before the post was a video, its prompt following', async () => {
    const draft = { prompt: 'A picture of a can', referenceAssetIds: [], run: null }
    generateDrafts.setState({ drafts: { [`${P}/L0`]: draft } })
    await openVideo()
    expect(makeGroup().getByRole('button', { name: 'Video' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Prompt')).toHaveValue('A video of a can')
  })

  it('disables "Video" with its line when no video service is set up', async () => {
    const { panel } = await openVideo({ providers: baseState().providers })
    expect(makeGroup().getByRole('button', { name: 'Video' })).toBeDisabled()
    expect(makeGroup().getByRole('button', { name: 'Picture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // ED-4a: the line is the "Video" segment's title; the picture's line is an InfoTip.
    expect(makeGroup().getByRole('button', { name: 'Video' })).toHaveAttribute(
      'title',
      'No video service is set up. Add a key in Settings.',
    )
    expect(panel.getByRole('button', { name: 'About pictures on a video post' })).toBeVisible()
    expect(panel.getByText(ON_TIMELINE)).toBeInTheDocument()
  })

  it.each([
    ['without its key', [], true],
    ['with its key saved', ['fal.apiKey' as const], false],
  ])('counts fal.ai as a video service only with its key: %s', async (_name, keys, off) => {
    await openVideo({ providers: [FAL], video: 'fal-seedance', keys })
    expect(makeGroup().getByRole('button', { name: 'Video' }).hasAttribute('disabled')).toBe(off)
  })

  it.each([
    ['the background of an image post', BACKGROUND, 'image'],
    ['an image layer of a video post', LOGO, 'video'],
  ] as const)('has no switch on %s', async (_name, layer, format) => {
    await openVideo({ layer, format })
    // ED-4a: "Make" shows on every picture and background layer, "Video" disabled here.
    expect(makeGroup().getByRole('button', { name: 'Video' })).toBeDisabled()
    expect(screen.queryByLabelText('Clip length (seconds)')).toBeNull()
  })

  it('shows the picture fields and their line on "Picture", and the video ones again on "Video"', async () => {
    const { panel } = await openVideo()
    await userEvent.click(makeGroup().getByRole('button', { name: 'Picture' }))
    // ED-4a: the picture's line is an InfoTip.
    expect(panel.getByRole('button', { name: 'About pictures on a video post' })).toBeVisible()
    expect(panel.getByText(ON_TIMELINE)).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Choose reference pictures…' })).toBeVisible()
    expect(startLabels()).toEqual(ALL_VIDEO_STARTS.slice(0, 3))
    await userEvent.click(makeGroup().getByRole('button', { name: 'Video' }))
    expect(clipLength()).toBeVisible()
  })

  it('lets the prompt follow the kind until the user types in it', async () => {
    await openVideo()
    const prompt = () => (screen.getByLabelText('Prompt') as HTMLTextAreaElement).value
    expect(prompt()).toMatch(/^A video of Citrus can /)
    await userEvent.click(makeGroup().getByRole('button', { name: 'Picture' }))
    expect(prompt()).toMatch(/^A picture of Citrus can /)
    await userEvent.click(makeGroup().getByRole('button', { name: 'Video' }))
    await typePrompt('A can rolls')
    await userEvent.click(makeGroup().getByRole('button', { name: 'Picture' }))
    expect(screen.getByLabelText('Prompt')).toHaveValue('A can rolls')
  })
})

describe('the video starts [R2E-8, D4; ported from video-offer, video-start]', () => {
  it("offers the four starts of the fake provider's offer, a prompt only first and chosen", async () => {
    await openVideo()
    expect(startLabels()).toEqual(ALL_VIDEO_STARTS)
    expect(startRadio('A prompt only')).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers only the starts ComfyUI has a workflow for', async () => {
    await openVideo({ providers: [COMFY], video: 'comfyui', info: INFO_NO_FRAME })
    expect(startLabels()).toEqual(['A prompt only', 'Reference pictures'])
  })

  it("sends a prompt start as start none with the layer, after the dialog's Generate", async () => {
    const { fake } = await openVideo()
    await typePrompt()
    await openDialog()
    expect(videoInputs(fake)).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() =>
      expect(videoInputs(fake)).toEqual([{ ...FIELDS, durationMs: 2000, ...NONE }]),
    )
  })

  it("sends this layer's picture as start background", async () => {
    const { fake } = await openVideo()
    await chooseStart("This layer's picture")
    await typePrompt()
    await generateVideo()
    await waitFor(() =>
      expect(videoInputs(fake)).toEqual([
        { ...FIELDS, durationMs: 2000, ...NONE, start: 'background' },
      ]),
    )
  })

  it("disables this layer's picture when the layer has none", async () => {
    await openVideo({ layer: { ...BACKGROUND, source: null } })
    expect(startRadio("This layer's picture")).toBeDisabled()
  })

  it('sends a picture of the same shape as the first frame, and needs one chosen', async () => {
    const { fake } = await openVideo({ rows: [A1, assetRow('S1'), ref('Q1')] })
    await typePrompt()
    await chooseStart('Another picture of the same shape…')
    expect(generateButton()).toBeDisabled()
    await userEvent.click(await screen.findByRole('radio', { name: 'S1.png' }))
    await generateVideo()
    await waitFor(() =>
      expect(videoInputs(fake)[0]).toMatchObject({
        start: 'first_frame',
        referenceAssetIds: ['S1'],
      }),
    )
  })

  it('sends no picture once the start is back to a prompt only', async () => {
    const { fake } = await openVideo({ rows: [A1, assetRow('S1')] })
    await chooseStart('Another picture of the same shape…')
    await userEvent.click(await screen.findByRole('radio', { name: 'S1.png' }))
    await chooseStart('A prompt only')
    await typePrompt()
    await generateVideo()
    await waitFor(() => expect(videoInputs(fake)[0]).toMatchObject(NONE))
  })

  it('disables Generate… for a length that is not a whole number of 1 or more', async () => {
    await openVideo()
    await userEvent.clear(clipLength())
    await userEvent.type(clipLength(), '0')
    expect(generateButton()).toBeDisabled()
    expect(screen.getByText('Enter a whole number of seconds, 1 or more.')).toBeVisible()
  })

  it('sends fal.ai a 2 s clip as 4 s, the length its line named, only after Generate', async () => {
    const { fake } = await openVideo({ providers: WITH_FAL, video: 'fal-seedance' })
    await typePrompt()
    const dialog = await openDialog()
    expect(dialog.getByText(costLine('Paid: 1 video, 4 seconds → fal.ai Seedance'))).toBeVisible()
    expect(videoInputs(fake)).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() =>
      expect(videoInputs(fake)).toEqual([
        { ...FIELDS, provider: 'fal-seedance', durationMs: 4000, ...NONE },
      ]),
    )
  })

  it('sends nothing when the dialog is cancelled', async () => {
    const { fake } = await openVideo({ providers: WITH_FAL, video: 'fal-seedance' })
    await typePrompt()
    const dialog = await openDialog()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(videoInputs(fake)).toEqual([])
  })

  it("sends ComfyUI the most of the start's workflow for a longer length", async () => {
    const { fake } = await openVideo({
      providers: [COMFY],
      video: 'comfyui',
      rows: [A1, ref('R1')],
    })
    await chooseStart('Reference pictures')
    await userEvent.click(await screen.findByRole('radio', { name: 'R1.png' }))
    await userEvent.clear(clipLength())
    await userEvent.type(clipLength(), '20')
    await typePrompt()
    const dialog = await openDialog()
    expect(
      await dialog.findByText(
        'ComfyUI makes clips of 1 to 10 seconds, so this one will be 10 seconds.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() =>
      expect(videoInputs(fake)[0]).toMatchObject({
        durationMs: 10_000,
        start: 'none',
        useReferences: true,
        referenceAssetIds: ['R1'],
      }),
    )
  })
})

describe('a started video in the panel [R2E-8, D6]', () => {
  it('follows the run under Generate… and shows its clip once done', async () => {
    const { fake } = await openVideo()
    await typePrompt()
    await generateVideo()
    expect(await screen.findByText('Making the video. Waiting.')).toBeVisible()
    const result = { ...CLIP, clipId: 'C9', replacedStill: true }
    act(() => fake.emit('job.updated', videoRow({ id: 'J7', status: 'succeeded', result })))
    expect(
      await screen.findByText(
        'Done. The new clip is on the timeline below, in place of the still.',
      ),
    ).toBeVisible()
    expect(screen.getByLabelText('Video result')).toBeInTheDocument()
  })
})
