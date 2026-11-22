// spec/screens-campaign.md, "The trial mark in the panels" (S2-7) [REQ: FR-254], on the path
// that remains once the campaign page's "Make pictures" panel goes (design wave CAMP-7): the
// run dialog the editor's Generate panel opens marks ComfyUI "(trial)" when the workflow
// offered for the run is a trial, follows the image_refs workflow when the run sends
// reference pictures, and never marks Gemini. Holds the cases of the campaign trial-mark test.
import { act, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { baseState, makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { COMFY } from '../screens/campaign/video-fixture'
import { info, workflow } from '../screens/settings/comfy-fixture'

const GEMINI = baseState().providers[0]!

// Pictures: a trial from a prompt, a proven one with references.
const INFO: ComfyInfo = info({
  workflows: [
    workflow({ id: 'moss-text-to-image', job: 'image', status: 'trial' }),
    workflow({ id: 'flux3-klein-edit-references', job: 'image_refs', status: 'proven' }),
  ],
})

async function open(referenceCount: number) {
  const fake = makeFakeApi(baseState({ providers: [GEMINI, COMFY] }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
  await renderApp(
    <RunDialog
      open
      projectId="P1"
      job="image"
      title="Make pictures"
      confirmLabel="Generate"
      referenceCount={referenceCount}
      onConfirm={vi.fn(async () => ({ ok: true as const, data: null }))}
      onCancel={() => {}}
    />,
    fake,
  )
  await screen.findByRole('dialog', { name: 'Make pictures' })
  await act(async () => {})
}

describe('The trial mark in the run dialog [S2-7]', () => {
  it('marks ComfyUI "(trial)" when the offered picture workflow is a trial', async () => {
    await open(0)
    expect(screen.getByRole('radio', { name: 'ComfyUI · MOSS-Image' })).toHaveAccessibleDescription(
      '(trial)',
    )
  })

  it('follows the image_refs workflow when the run sends a reference: a proven one has no mark', async () => {
    await open(1)
    const comfy = screen.getByRole('radio', { name: 'ComfyUI · MOSS-Image' })
    expect(comfy).toBeEnabled()
    expect(comfy).not.toHaveAccessibleDescription('(trial)')
  })

  it('never marks Gemini', async () => {
    await open(0)
    expect(screen.getByRole('radio', { name: 'Google Gemini' })).not.toHaveAccessibleDescription(
      '(trial)',
    )
  })
})
