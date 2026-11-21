// spec/screens-campaign.md, "The trial mark in the panels" (S2-7) [REQ: FR-254]: with ComfyUI
// chosen and the offered workflow for the panel's run a `trial`, the provider reads
// "ComfyUI (trial)". The field's label stays "Provider".
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { axeViolations } from '../../render'
import { baseState } from '../../fake-api'
import { info, workflow } from '../settings/comfy-fixture'
import { P, renderWith } from './campaign-fixture'
import { ref, referenceApi } from './reference-fixture'
import { COMFY } from './video-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const GEMINI = baseState().providers[0]!

// Pictures: a trial from a prompt, a proven one with references. Video: a trial from a prompt,
// a proven one from a first frame.
const INFO: ComfyInfo = info({
  workflows: [
    workflow({ id: 'moss-text-to-image', job: 'image', status: 'trial' }),
    workflow({ id: 'flux3-klein-edit-references', job: 'image_refs', status: 'proven' }),
    workflow({
      id: 'h3-text-to-video',
      job: 'video',
      status: 'trial',
      videoStart: { firstFrame: false, references: false },
      video: { fps: 24, maxMs: 15_000, frameStep: 17, frameOffset: 5 },
    }),
    workflow({
      id: 'h3-image-to-video',
      job: 'video',
      status: 'proven',
      videoStart: { firstFrame: true, references: false },
      video: { fps: 24, maxMs: 30_000, frameStep: 17, frameOffset: 5 },
    }),
  ],
})

async function render() {
  const { fake } = referenceApi([ref('A1')], { state: { providers: [GEMINI, COMFY] } })
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
  await renderWith(view, fake)
  await screen.findByRole('checkbox', { name: 'A1.png' })
  return fake
}

async function card(name: string) {
  return within(await screen.findByRole('region', { name }))
}

// What the panel reads: the chosen name, then the mark the select is described by, if any.
function chosen(select: HTMLElement): string {
  const name = within(select).getByRole('option', { selected: true }).textContent ?? ''
  const markId = select.getAttribute('aria-describedby')
  const mark = markId === null ? null : document.getElementById(markId)?.textContent
  return mark ? `${name} ${mark}` : name
}

describe('The trial mark in the panels [S2-7]', () => {
  it('reads "ComfyUI (trial)" when the offered picture workflow is a trial', async () => {
    await render()
    const select = (await card('Make pictures')).getByLabelText('Provider')
    await userEvent.selectOptions(select, 'comfyui')
    await waitFor(() => expect(chosen(select)).toBe('ComfyUI (trial)'))
    expect(select).toHaveAccessibleDescription('(trial)')
  })

  it('keeps the option\'s own name "ComfyUI" and the label "Provider", so the helpers find both', async () => {
    await render()
    const video = await card('Make a video')
    await waitFor(() => expect(chosen(video.getByLabelText('Provider'))).toBe('ComfyUI (trial)'))
    expect(video.getByRole('combobox', { name: 'Provider' })).toHaveValue('comfyui')
    expect(video.getByRole('option', { name: 'ComfyUI' })).toBeInTheDocument()
  })

  it('follows the image_refs workflow once a reference is ticked: a proven one has no mark', async () => {
    await render()
    const select = (await card('Make pictures')).getByLabelText('Provider')
    await userEvent.selectOptions(select, 'comfyui')
    await waitFor(() => expect(chosen(select)).toBe('ComfyUI (trial)'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'A1.png' }))
    expect(chosen(select)).toBe('ComfyUI')
    await userEvent.click(screen.getByRole('checkbox', { name: 'A1.png' }))
    expect(chosen(select)).toBe('ComfyUI (trial)')
  })

  it('never marks Gemini, nor ComfyUI while Gemini is chosen', async () => {
    await render()
    const select = (await card('Make pictures')).getByLabelText('Provider')
    await screen.findByRole('region', { name: 'Make a video' })
    expect(select).toHaveValue('gemini')
    const names = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(names).toEqual(['Google Gemini', 'ComfyUI'])
  })

  it('follows the chosen start on the video card', async () => {
    await render()
    const video = await card('Make a video')
    const select = video.getByLabelText('Provider')
    await waitFor(() => expect(chosen(select)).toBe('ComfyUI (trial)'))
    await userEvent.selectOptions(video.getByLabelText('Start from'), 'A first-frame picture')
    expect(chosen(select)).toBe('ComfyUI')
  })

  it('has no axe violations with the mark showing', async () => {
    await render()
    const video = await card('Make a video')
    await waitFor(() => expect(chosen(video.getByLabelText('Provider'))).toBe('ComfyUI (trial)'))
    expect(await axeViolations()).toEqual([])
  })
})
