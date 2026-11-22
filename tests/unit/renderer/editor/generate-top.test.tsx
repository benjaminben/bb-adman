// ED-4a (spec/phases/design-wave-screens-a.md): the Generate panel's top half. A Section
// "Generate"; "Make" as two segments, the video reason on a disabled "Video"; "Start from" as
// pressed-state tiles; the chosen references as a strip of thumbnails; the prompt; one primary
// "Generate…", which only opens the run dialog (C-15). Nothing is sent from the panel.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import layout from '@/renderer/ui/layout.module.css'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { costLine } from '../cost-line'
import { baseState } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { jobRow } from '../stores/job-fixture'
import { assetRow, BACKGROUND, LOGO, P } from './editor-fixture'
import { FAKE_VIDEO, INFO_ALL } from './generate-panel-video-fixture'

type Row = AssetList[number]
const can = (id: string) => ref(id, { subjectId: 'citrus-can' })
const A1 = assetRow('A1')

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

type Opts = { layer?: LayerRow; format?: 'image' | 'video'; video?: boolean; gemini?: boolean }

async function open(opts: Opts = {}, rows: Row[] = [A1, can('R1'), can('R2')]) {
  const state = baseState()
  const settings = state.settings
  const fake = campaignApi({
    state: {
      providers: opts.video ? [FAKE_VIDEO] : state.providers,
      ...(opts.gemini ? { secrets: [{ name: 'gemini.apiKey', lastFour: '1234' }] } : {}),
      settings: {
        ...settings,
        defaultProviders: {
          ...settings.defaultProviders,
          image: opts.gemini ? 'gemini' : 'fake',
          video: 'fake',
        },
      },
    },
  })
  fake.onQuery('asset.list', () => ({ ok: true, data: rows }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO_ALL }))
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 0, videos: 0, text: 0 },
  }))
  fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J1' } }))
  await renderApp(
    <main>
      <GeneratePanel
        projectId={P}
        campaignId="C1"
        layer={opts.layer ?? LOGO}
        format={opts.format ?? 'image'}
      />
    </main>,
    fake,
  )
  // The layer's first draft fills the prompt.
  await waitFor(() => expect(screen.getByLabelText('Prompt')).not.toHaveValue(''))
  return fake
}

const section = () => within(screen.getByRole('region', { name: 'Generate' }))
const make = () => within(screen.getByRole('group', { name: 'Make' }))
const starts = () => within(screen.getByRole('group', { name: 'Start from' }))
const strip = () => within(screen.getByRole('list', { name: 'Reference pictures' }))
const removeButtons = () => strip().queryAllByRole('button', { name: /^Remove / })
const chosenIds = () => Object.values(generateDrafts.getState().drafts)[0]?.referenceAssetIds

describe('the Generate Section [ED-4a]', () => {
  it('is a Section with a heading button "Generate", and one primary: Generate…', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Generate', level: 4 })).toBeInTheDocument()
    expect(section().getByRole('button', { name: 'Generate' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const primaries = screen
      .getByRole('region', { name: 'Generate' })
      .querySelectorAll(`.${layout.primary}`)
    expect([...primaries].map((b) => b.textContent)).toEqual(['Generate…'])
    expect(await axeViolations()).toEqual([])
  })

  it('shows a Running mark while the run goes', async () => {
    const fake = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    act(() => fake.emit('job.updated', jobRow('J1', { status: 'running' })))
    expect(await section().findByText('Running')).toBeVisible()
    act(() => fake.emit('job.updated', jobRow('J1', { status: 'cancelled' })))
    await waitFor(() => expect(section().queryByText('Running')).toBeNull())
  })
})

describe('"Make" [ED-4a]', () => {
  it.each([
    ['a picture layer of an image post', LOGO, 'image', 'Videos are made on the background layer.'],
    [
      'the background of an image post',
      BACKGROUND,
      'image',
      'To make a video, set Format to Video in the top bar first.',
    ],
    ['a picture layer of a video post', LOGO, 'video', 'Videos are made on the background layer.'],
  ] as const)('disables "Video" on %s, its reason in title and description', async (...a) => {
    const [, layer, format, reason] = a
    await open({ layer, format, video: true })
    expect(make().getByRole('button', { name: 'Picture' })).toHaveAttribute('aria-pressed', 'true')
    const video = make().getByRole('button', { name: 'Video' })
    expect(video).toBeDisabled()
    expect(video).toHaveAttribute('title', reason)
    expect(video).toHaveAccessibleDescription(reason)
    expect(screen.queryByText(reason, { selector: 'p' })).toBeNull()
  })

  it('disables "Video" when no video service is set up, with an InfoTip for the picture', async () => {
    await open({ layer: BACKGROUND, format: 'video' })
    const video = make().getByRole('button', { name: 'Video' })
    const reason = 'No video service is set up. Add a key in Settings.'
    expect(video).toBeDisabled()
    expect(video).toHaveAttribute('title', reason)
    expect(video).toHaveAccessibleDescription(reason)
    expect(screen.getByRole('button', { name: 'About pictures on a video post' })).toBeVisible()
  })

  it("switches the fields on a video post's background", async () => {
    await open({ layer: BACKGROUND, format: 'video', video: true })
    expect(make().getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Prompt')).toHaveAttribute('placeholder', 'Describe the video')
    const length = screen.getByRole('spinbutton', { name: 'Clip length (seconds)' })
    expect(length.closest(`.${layout.field}`)).toHaveTextContent(/^Lengths$/)
    await userEvent.click(make().getByRole('button', { name: 'Picture' }))
    expect(screen.getByLabelText('Prompt')).toHaveAttribute('placeholder', 'Describe the picture')
    expect(screen.queryByRole('spinbutton', { name: 'Clip length (seconds)' })).toBeNull()
    expect(screen.getByRole('button', { name: 'About pictures on a video post' })).toBeVisible()
  })
})

describe('"Start from" [ED-4a]', () => {
  it('is a group of pressed-state tiles with the built names', async () => {
    await open({ layer: BACKGROUND })
    const tiles = starts().getAllByRole('button')
    expect(tiles.map((t) => t.textContent)).toEqual([
      'A prompt only',
      "This layer's picture",
      'Another picture of the same shape…',
    ])
    expect(tiles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    await userEvent.click(starts().getByRole('button', { name: "This layer's picture" }))
    expect(starts().getByRole('button', { name: "This layer's picture" })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(starts().getByRole('button', { name: /^Another picture/ }))
    expect(await screen.findByRole('region', { name: 'Pictures of the same shape' })).toBeVisible()
  })

  it('gives a disabled tile its reason', async () => {
    await open()
    const tile = starts().getByRole('button', { name: "This layer's picture" })
    expect(tile).toBeDisabled()
    expect(tile).toHaveAttribute('title', 'This layer has no picture yet.')
    expect(tile).toHaveAccessibleDescription('This layer has no picture yet.')
  })
})

describe('the reference strip [ED-4a]', () => {
  it('shows the chosen pictures by display name, with no path or hash', async () => {
    await open()
    expect(
      strip()
        .getAllByRole('img')
        .map((i) => i.getAttribute('alt')),
    ).toEqual(['R1.png', 'R2.png'])
    const html = screen.getByRole('region', { name: 'Generate' }).outerHTML
    expect(html).not.toMatch(/Pictures\/|hash-R/)
  })

  it('"Remove {name}" drops one from the draft; "+" opens the reference dialog', async () => {
    await open()
    await userEvent.click(strip().getByRole('button', { name: 'Remove R1.png' }))
    expect(chosenIds()).toEqual(['R2'])
    expect(removeButtons()).toHaveLength(1)
    await userEvent.click(strip().getByRole('button', { name: 'Choose reference pictures…' }))
    expect(await screen.findByRole('dialog', { name: 'Reference pictures for Logo' })).toBeVisible()
  })

  it('is disabled on a locked layer', async () => {
    await open({ layer: { ...LOGO, locked: true } })
    expect(strip().getByRole('button', { name: 'Choose reference pictures…' })).toBeDisabled()
    removeButtons().forEach((b) => expect(b).toBeDisabled())
  })

  it("counts one reference fewer in the next run dialog's cost line after a ✕", async () => {
    await open({ gemini: true })
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    expect(await dialog.findByText(costLine('Paid: 4 pictures + 2 references → Google Gemini')))
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(strip().getByRole('button', { name: 'Remove R2.png' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    expect(await dialog.findByText(costLine('Paid: 4 pictures + 1 reference → Google Gemini')))
  })
})

describe('nothing is sent from the panel [ED-4a, C-15]', () => {
  it('walks every control and sends no command until the dialog button', async () => {
    const fake = await open({ layer: BACKGROUND, format: 'video', video: true })
    await userEvent.click(make().getByRole('button', { name: 'Picture' }))
    await userEvent.click(starts().getByRole('button', { name: "This layer's picture" }))
    await userEvent.click(starts().getByRole('button', { name: /^Another picture/ }))
    await userEvent.click(starts().getByRole('button', { name: 'A prompt only' }))
    await userEvent.click(strip().getByRole('button', { name: 'Remove R1.png' }))
    await userEvent.type(screen.getByLabelText('Prompt'), ' at noon')
    await userEvent.click(make().getByRole('button', { name: 'Video' }))
    await userEvent.click(starts().getByRole('button', { name: 'Reference pictures' }))
    await userEvent.clear(screen.getByLabelText('Clip length (seconds)'))
    await userEvent.type(screen.getByLabelText('Clip length (seconds)'), '3')
    await userEvent.click(make().getByRole('button', { name: 'Picture' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    expect(fake.commands).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(sent(fake, 'generation.runImages')).toHaveLength(1))
    expect(fake.commands.map((c) => c.name)).toEqual(['generation.runImages'])
  })
})
