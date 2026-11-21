// spec/screens-ai.md, "Generate fields" [FR-062, FR-063; workflow 5.1 step 5; A-70]: the prompt
// and the reference pictures, kept per layer; "Generate…" goes through the run dialog to one
// generation.runImages for the layer; one line follows the started job.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { prefilledPrompt } from '@/shared/generation/prompt'
import { plainMessage } from '@/shared/providers/messages'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, LOGO, P } from './editor-fixture'

const PROMPT = prefilledPrompt({
  subjects: [{ name: 'Citrus can', description: 'A slim can' }],
  audience: 'Adults 21 to 35',
  region: 'US',
  message: '<b>Cool</b> down',
})
const can = (id: string, over: Partial<AssetList[number]> = {}) =>
  ref(id, { subjectId: 'citrus-can', ...over })

beforeEach(() => generateDrafts.setState({ drafts: {} }))

// Shows one layer's fields, and a button that switches between the logo and the background.
function Harness(props: { layer: LayerRow }) {
  const [layer, setLayer] = useState(props.layer)
  return (
    <main>
      <button type="button" onClick={() => setLayer(layer.id === LOGO.id ? BACKGROUND : LOGO)}>
        Switch
      </button>
      <GenerateFields key={layer.id} projectId={P} campaignId="C1" layer={layer} />
    </main>
  )
}

async function open(opts: { refs?: AssetList; layer?: LayerRow } = {}) {
  const fake = campaignApi()
  fake.onQuery('asset.list', () => ({ ok: true, data: opts.refs ?? [can('R1'), ref('R2')] }))
  fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J1' } }))
  await renderApp(<Harness layer={opts.layer ?? LOGO} />, fake)
  // The line shows once the layer's first draft is made.
  await screen.findByText(/^(None|\d+) chosen$/)
  return { fake, prompt: screen.getByRole('textbox', { name: 'Prompt' }) }
}

async function generate() {
  await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Make pictures' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Generate' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

describe('GenerateFields [spec/screens-ai.md "Generate fields"; FR-062, FR-063]', () => {
  it("fills the prompt from the variant's subjects and the campaign", async () => {
    const { prompt } = await open()
    expect(prompt).toHaveValue(PROMPT)
  })

  const tenCans = Array.from({ length: 10 }, (_, i) => can(`R${i}`))
  it.each([
    ['only the subjects’ pictures', [can('R1'), ref('R2'), can('R3')], '2 chosen'],
    ['skipping a missing file', [can('R1', { missing: true }), can('R2')], '1 chosen'],
    ['at most 8', tenCans, '8 chosen'],
    ['none when the subjects have none', [ref('R2')], 'None chosen'],
  ])('chooses the reference pictures the first time: %s', async (_name, refs, line) => {
    await open({ refs })
    expect(await screen.findByText(line)).toBeVisible()
  })

  it('keeps the prompt and the chosen pictures per layer', async () => {
    const { prompt } = await open()
    await userEvent.clear(prompt)
    await userEvent.type(prompt, 'A can on ice')
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    expect(await screen.findByRole('textbox', { name: 'Prompt' })).not.toHaveValue('A can on ice')
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    expect(await screen.findByRole('textbox', { name: 'Prompt' })).toHaveValue('A can on ice')
    expect(screen.getByText('1 chosen')).toBeVisible()
  })

  it('chooses reference pictures in the reference dialog', async () => {
    await open({ refs: [can('R1'), ref('R2')] })
    await userEvent.click(screen.getByRole('button', { name: 'Choose reference pictures…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reference pictures for Logo' })
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'R2.png' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('2 chosen')).toBeVisible()
  })

  it('Generate opens the run dialog, and Confirm sends one generation.runImages for the layer', async () => {
    const { fake } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make pictures' })
    expect(within(dialog).getByRole('spinbutton', { name: 'Pictures' })).toHaveValue(4)
    expect(sent(fake, 'generation.runImages')).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'generation.runImages').map((c) => c.input)).toEqual([
      {
        projectId: P,
        variantId: 'V1',
        layerId: LOGO.id,
        prompt: PROMPT,
        referenceAssetIds: ['R1'],
        count: 4,
        provider: 'gemini',
      },
    ])
  })

  it.each([
    ['succeeded', {}, 'Done. Choose one under Earlier options.'],
    ['failed', { errorKind: 'quota' as const }, plainMessage('quota', 'Google Gemini')],
    ['cancelled', {}, 'Cancelled.'],
  ] as const)('the line follows the started job until it has %s', async (status, over, line) => {
    const { fake } = await open()
    await generate()
    expect(await screen.findByText('Making 4 pictures…')).toBeVisible()
    act(() => fake.emit('job.updated', jobRow('J2', { status: 'succeeded' })))
    act(() => fake.emit('job.updated', jobRow('J1', { status: 'running' })))
    expect(screen.getByText('Making 4 pictures…')).toBeVisible()
    act(() => fake.emit('job.updated', jobRow('J1', { status, ...over })))
    expect(await screen.findByText(line)).toBeVisible()
  })

  it('disables every field of a locked layer', async () => {
    await open({ layer: { ...LOGO, locked: true } })
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose reference pictures…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generate…' })).toBeDisabled()
  })

  it('has no axe violations', async () => {
    await open()
    await screen.findByText('1 chosen')
    expect(await axeViolations()).toEqual([])
  })
})

describe('GenerateFields first draft [SP-7]', () => {
  it("reads every image and chooses the subject's asset-library photo", async () => {
    const photo = can('S1', { library: 'asset' })
    const { fake } = await open({ refs: [photo, ref('R2'), ref('A3', { library: 'asset' })] })
    expect(await screen.findByText('1 chosen')).toBeVisible()
    expect(fake.queries.filter((q) => q.name === 'asset.list')[0]?.input).toEqual({
      projectId: P,
      kind: 'image',
    })
    await generate()
    expect(
      sent(fake, 'generation.runImages').map(
        (c) => (c.input as { referenceAssetIds: string[] }).referenceAssetIds,
      ),
    ).toEqual([['S1']])
  })
})
