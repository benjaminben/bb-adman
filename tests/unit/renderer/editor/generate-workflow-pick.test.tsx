// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker): the Generate fields and the
// video fields send the workflow picked in the run dialog in generation.runImages and
// generation.startVideo, and the window remembers it after the accepted reply. With one
// fitting workflow nothing names a workflow. Every command reaches only the fake API.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { baseState } from '../fake-api'
import { renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { COMFY, INFO } from '../screens/campaign/video-fixture'
import { info, workflow } from '../screens/settings/comfy-fixture'
import { PORTRAIT, TIDE_CLIP } from '../screens/settings/custom-workflow-fixture'
import { LOGO, P, variantGet } from './editor-fixture'
import { openDialog, openVideo, videoInputs } from './generate-panel-video-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

const MOSS = workflow({ label: 'MOSS picture from a prompt', status: 'proven' })
const TWO_IMAGE = info({ workflows: [MOSS, PORTRAIT] })

async function openFields(comfyInfo: ComfyInfo) {
  const settings = baseState().settings
  const fake = campaignApi({
    state: {
      providers: [COMFY],
      settings: {
        ...settings,
        defaultProviders: { ...settings.defaultProviders, image: 'comfyui' },
      },
    },
  })
  fake.onQuery('asset.list', () => ({ ok: true, data: [ref('R2')] }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: comfyInfo }))
  fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J1' } }))
  fake.onQuery('variant.get', () => ({ ok: true, data: variantGet() }))
  await renderApp(<GenerateFields projectId={P} campaignId="C1" layer={LOGO} />, fake)
  await screen.findByRole('list', { name: 'Reference pictures' })
  await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Generate' })).toBeEnabled())
  return { fake, dialog }
}

const choiceUpdates = (fake: ReturnType<typeof campaignApi>) =>
  sent(fake, 'settings.update').map((c) => c.input)

describe('GenerateFields sends the picked workflow [CW-5]', () => {
  it('sends its ID in generation.runImages and remembers it after the reply', async () => {
    const { fake, dialog } = await openFields(TWO_IMAGE)
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Workflow' }), PORTRAIT.id)
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(sent(fake, 'generation.runImages')).toHaveLength(1))
    expect(sent(fake, 'generation.runImages')[0]?.input).toMatchObject({
      provider: 'comfyui',
      workflowId: PORTRAIT.id,
    })
    await waitFor(() =>
      expect(choiceUpdates(fake)).toEqual([{ comfyWorkflowChoice: { image: PORTRAIT.id } }]),
    )
  })

  it('names no workflow with one fitting', async () => {
    const { fake, dialog } = await openFields(info({ workflows: [MOSS] }))
    expect(dialog.queryByRole('combobox', { name: 'Workflow' })).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(sent(fake, 'generation.runImages')).toHaveLength(1))
    expect(sent(fake, 'generation.runImages')[0]?.input).not.toHaveProperty('workflowId')
    expect(choiceUpdates(fake)).toEqual([])
  })
})

describe('VideoFields sends the picked workflow [CW-5]', () => {
  const twoPrompt: ComfyInfo = { ...INFO, workflows: [...INFO.workflows, TIDE_CLIP] }

  it('sends its ID in generation.startVideo and remembers it for the start', async () => {
    const { fake } = await openVideo({ providers: [COMFY], video: 'comfyui', info: twoPrompt })
    await userEvent.type(screen.getByLabelText('Prompt'), 'Waves at dusk')
    const dialog = await openDialog()
    const select = await dialog.findByRole('combobox', { name: 'Workflow' })
    await userEvent.selectOptions(select, TIDE_CLIP.id)
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(videoInputs(fake)).toHaveLength(1))
    expect(videoInputs(fake)[0]).toMatchObject({ provider: 'comfyui', workflowId: TIDE_CLIP.id })
    await waitFor(() =>
      expect(choiceUpdates(fake)).toEqual([
        { comfyWorkflowChoice: { video_prompt: TIDE_CLIP.id } },
      ]),
    )
  })

  it('names no workflow with one fitting', async () => {
    const { fake } = await openVideo({ providers: [COMFY], video: 'comfyui' })
    await userEvent.type(screen.getByLabelText('Prompt'), 'Waves at dusk')
    const dialog = await openDialog()
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Generate' })).toBeEnabled())
    expect(dialog.queryByRole('combobox', { name: 'Workflow' })).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(videoInputs(fake)).toHaveLength(1))
    expect(videoInputs(fake)[0]).not.toHaveProperty('workflowId')
  })
})
