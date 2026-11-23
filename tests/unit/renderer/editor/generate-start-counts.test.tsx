// spec/screens-ai.md, "Generate fields": a run that starts from a picture sends that picture
// first, so it counts toward the pictures a workflow takes. When ComfyUI refuses the run for
// too many pictures, the run dialog says the start picture is one of them and what to do.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { startCountsReply } from '@/renderer/editor/generate-fields/start-counts'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { tooManyReferencesMessage } from '@/shared/providers/messages'
import type { Result } from '@/shared/schemas/result'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'
import { LOGO, P, variantGet } from './editor-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {} }))

const refused = (max: number): Result<unknown> => ({
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: tooManyReferencesMessage(max),
    details: { reason: 'too_many_references', max },
  },
})
const ONE =
  'ComfyUI takes one picture for this run, and the picture you start from counts as one. ' +
  'Remove the reference picture, or start from a prompt only.'

const message = (reply: Result<unknown>) => (reply.ok ? null : reply.error.message)

describe('startCountsReply', () => {
  it('says the start picture counts when the workflow takes one picture', () => {
    expect(message(startCountsReply(refused(1), true, 1))).toBe(ONE)
  })

  it('names several reference pictures in the plural', () => {
    expect(message(startCountsReply(refused(1), true, 2))).toBe(
      'ComfyUI takes one picture for this run, and the picture you start from counts as one. ' +
        'Remove the reference pictures, or start from a prompt only.',
    )
  })

  it('gives the limit when the workflow takes more than one', () => {
    expect(message(startCountsReply(refused(2), true, 2))).toBe(
      'ComfyUI takes at most 2 pictures for this run, and the picture you start from counts ' +
        'as one. Remove a reference picture, or start from a prompt only.',
    )
  })

  it('keeps the reason and the limit', () => {
    const reply = startCountsReply(refused(1), true, 1)
    expect(reply.ok ? null : reply.error.details).toEqual({ reason: 'too_many_references', max: 1 })
  })

  it('leaves the reply alone with no start picture, no reference or another refusal', () => {
    expect(startCountsReply(refused(1), false, 2)).toEqual(refused(1))
    expect(startCountsReply(refused(1), true, 0)).toEqual(refused(1))
    const other: Result<unknown> = {
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'No.',
        details: { reason: 'comfy_address_needed' },
      },
    }
    expect(startCountsReply(other, true, 1)).toEqual(other)
    const fine: Result<unknown> = { ok: true, data: { jobId: 'J1' } }
    expect(startCountsReply(fine, true, 1)).toEqual(fine)
  })
})

describe('GenerateFields with a start picture', () => {
  it('shows the sentence in the run dialog when the run is refused', async () => {
    const fake = campaignApi()
    fake.onQuery('asset.list', () => ({
      ok: true,
      data: [ref('R1', { subjectId: 'citrus-can' }), ref('R2')],
    }))
    fake.onCommand('generation.runImages', () => refused(1))
    fake.onQuery('variant.get', () => ({ ok: true, data: variantGet() }))
    await renderApp(<GenerateFields projectId={P} campaignId="C1" layer={LOGO} start="R2" />, fake)
    await screen.findByRole('button', { name: /^Remove / })
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    expect(await dialog.findByText(ONE)).toBeVisible()
  })
})
