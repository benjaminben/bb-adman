// R2E-8 (spec/phases/round-2-editor.md D4): the Generate panel's video pictures and what the
// run dialog does with a refusal, the licence question and the trial mark. Ported from the
// "Make a video" card's tests (video-picture, video-picture-pre-choice, video-card-licence,
// trial-mark's video part) so their cases hold in the panel.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { ErrorCode } from '@/shared/schemas/result'
import { axeViolations } from '../render'
import { sent } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import {
  A1,
  COMFY,
  INFO_ALL,
  P,
  chooseStart,
  generateVideo,
  openDialog,
  openVideo,
  type PanelOpts,
  videoInputs,
} from './generate-panel-video-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

const can = (id: string, over = {}) => ref(id, { subjectId: 'citrus-can', ...over })

async function references(opts: PanelOpts = {}) {
  const view = await openVideo(opts)
  await chooseStart('Reference pictures')
  const list = within(await screen.findByRole('region', { name: 'Picture to start from' }))
  return { ...view, list }
}

describe('the reference pictures of a video [R2E-8; ported from video-picture]', () => {
  it("shows the project's pictures by asset address, with no path", async () => {
    const { fake, list } = await references({ rows: [A1, ref('R1'), ref('R2')] })
    // The list holds the reference pictures and subject photos; A1 is neither.
    await list.findAllByRole('checkbox')
    const srcs = list.getAllByRole('presentation').map((img) => img.getAttribute('src'))
    expect(srcs).toEqual([`adman-asset://${P}/R1`, `adman-asset://${P}/R2`])
    expect(document.body.innerHTML).not.toContain('/Users/me/Pictures')
    expect(document.body.innerHTML).not.toContain('/pictures/A1.png')
    const asked = fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)
    expect(asked).toContainEqual({ projectId: P, kind: 'image' })
  })

  it("takes up to the provider's most, and sends each chosen picture", async () => {
    const rows = ['R1', 'R2', 'R3', 'R4', 'R5'].map((id) => ref(id))
    const { fake, list } = await references({ rows })
    const boxes = await list.findAllByRole('checkbox')
    for (const box of boxes.slice(0, 4)) await userEvent.click(box)
    expect(boxes[4]).toBeDisabled()
    await userEvent.click(boxes[0]!)
    await userEvent.click(boxes[4]!)
    await generateVideo()
    await waitFor(() =>
      expect(videoInputs(fake)[0]).toMatchObject({
        start: 'none',
        useReferences: true,
        referenceAssetIds: ['R2', 'R3', 'R4', 'R5'],
      }),
    )
  })

  it('shows why a picture cannot be sent, and it cannot be chosen', async () => {
    const { list } = await references({ rows: [ref('R1', { missing: true }), ref('R2')] })
    expect(await list.findByRole('checkbox', { name: 'R1.png' })).toBeDisabled()
    expect(list.getByText('file not found')).toBeInTheDocument()
  })

  it('needs a picture chosen before Generate…', async () => {
    const { list } = await references({ rows: [ref('R1')] })
    await list.findByRole('checkbox', { name: 'R1.png' })
    expect(screen.getByRole('button', { name: 'Generate…' })).toBeDisabled()
  })

  it('imports through "Add pictures" for the subject and chooses the first added', async () => {
    const { fake, list: rows } = await openVideo({ rows: [ref('R1')] })
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      rows.rows = [ref('R1'), ref('N1')]
      return { ok: true, data: { assetIds: ['N1'] } }
    })
    await chooseStart('Reference pictures')
    const list = within(await screen.findByRole('region', { name: 'Picture to start from' }))
    await userEvent.click(list.getByRole('button', { name: 'Add pictures' }))
    expect(await list.findByRole('checkbox', { name: 'N1.png' })).toBeChecked()
    expect(sent(fake, 'asset.import')[0]?.input).toMatchObject({ subjectId: 'citrus-can' })
  })

  it('has no axe problems', async () => {
    const { list } = await references({ rows: [ref('R1')] })
    await list.findAllByRole('checkbox')
    expect(await axeViolations()).toEqual([])
  })
})

describe('subject photos chosen first [SP-7; ported from video-picture-pre-choice]', () => {
  // S1 is the oldest subject photo but cannot be sent, so S2 is chosen.
  const ROWS = [ref('R1'), can('S1', { missing: true }), can('S2'), ref('A2')]

  it('chooses the first photo of the subject that can be sent, and sends it only after Generate', async () => {
    const { fake, list } = await references({ rows: ROWS })
    expect(await list.findByRole('checkbox', { name: 'S2.png' })).toBeChecked()
    expect(videoInputs(fake)).toEqual([])
    await generateVideo()
    await waitFor(() => expect(videoInputs(fake)[0]).toMatchObject({ referenceAssetIds: ['S2'] }))
  })

  it('chooses nothing when the subject has no photo', async () => {
    const { list } = await references({ rows: [ref('R1'), ref('B1', { subjectId: 'berry' })] })
    await list.findByRole('checkbox', { name: 'R1.png' })
    expect(list.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)).toEqual([])
  })
})

const REFUSALS = [
  ['INVALID_INPUT', 'Choose one picture for this video.', undefined],
  ['RULE_VIOLATION', 'ComfyUI does not offer this video start.', 'comfy_job_not_offered'],
  ['RULE_VIOLATION', 'ComfyUI makes clips of at most 30 seconds.', 'video_too_long'],
  [
    'RULE_VIOLATION',
    'This post has no background picture yet. Add one, or start from a prompt.',
    'background_empty',
  ],
] as const

describe('refusals in the run dialog [ported from video-picture, video-offer]', () => {
  it.each(REFUSALS)(
    'shows a %s refusal as the command gives it: %s',
    async (code, message, why) => {
      const { fake } = await openVideo()
      fake.onCommand('generation.startVideo', () => ({
        ok: false,
        error: { code: code as ErrorCode, message, ...(why && { details: { reason: why } }) },
      }))
      const dialog = await generateVideo()
      expect(await dialog.findByRole('alert')).toHaveTextContent(message)
      await waitFor(() => expect(dialog.getByRole('button', { name: 'Generate' })).toBeEnabled())
    },
  )
})

const TITLE =
  'Clipmaker 2 requires a commercial license, please confirm that you have one before production use'
const LICENCE = {
  ok: false as const,
  error: {
    code: 'INVALID_INPUT' as const,
    message: 'This model requires a commercial license.',
    details: { reason: 'licence_not_confirmed', workflow: 'h3-text-to-video' },
  },
}

async function startOnComfy() {
  const workflows = INFO_ALL.workflows.map((w) => ({
    ...w,
    model: { label: 'Clipmaker 2', mainFile: 'clipmaker-2.safetensors' },
  }))
  const { fake } = await openVideo({
    providers: [COMFY],
    video: 'comfyui',
    info: { ...INFO_ALL, workflows },
    licence: true,
  })
  fake.onCommand('generation.startVideo', (input) =>
    (input as { licenceConfirmed?: boolean }).licenceConfirmed ? { ok: true, data: null } : LICENCE,
  )
  await generateVideo()
  return { fake, licence: within(await screen.findByRole('dialog', { name: TITLE })) }
}

describe('the licence dialog [D-088; ported from video-card-licence]', () => {
  it('sends nothing more on Cancel', async () => {
    const { fake, licence } = await startOnComfy()
    await userEvent.click(licence.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull())
    expect(videoInputs(fake)).toHaveLength(1)
  })

  it('sends the start again with licenceConfirmed on Confirm', async () => {
    const { fake, licence } = await startOnComfy()
    await userEvent.click(licence.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(videoInputs(fake)).toHaveLength(2))
    expect(videoInputs(fake)[1]).toMatchObject({ licenceConfirmed: true, layerId: 'L0' })
  })
})

describe('the trial mark [S2-7; ported from trial-mark, video part]', () => {
  it.each([
    ['A prompt only', '(trial)'],
    ['Reference pictures', '(trial)'],
  ])('marks ComfyUI for %s by its workflow', async (start, mark) => {
    await openVideo({ providers: [COMFY], video: 'comfyui', rows: [ref('R1')] })
    await chooseStart(start)
    if (start === 'Reference pictures') {
      await userEvent.click(await screen.findByRole('radio', { name: 'R1.png' }))
    }
    const dialog = await openDialog()
    const comfy = await dialog.findByRole('radio', { name: 'ComfyUI' })
    expect(comfy).toHaveAccessibleDescription(mark)
  })

  it('shows no mark for a proven workflow', async () => {
    const workflows = INFO_ALL.workflows.map((w) =>
      w.videoStart?.firstFrame ? { ...w, status: 'proven' as const } : w,
    )
    await openVideo({
      providers: [COMFY],
      video: 'comfyui',
      info: { ...INFO_ALL, workflows },
      rows: [A1, { ...A1, id: 'S1', displayName: 'S1.png' }],
    })
    await chooseStart('Another picture of the same shape…')
    await userEvent.click(await screen.findByRole('radio', { name: 'S1.png' }))
    const dialog = await openDialog()
    const comfy = await dialog.findByRole('radio', { name: 'ComfyUI' })
    expect(comfy).not.toHaveAccessibleDescription()
  })
})
