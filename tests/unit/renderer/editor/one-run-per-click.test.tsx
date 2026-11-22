// SPEC 14 1.48 TL-2 "one run per click", on the editor path that remains once the campaign
// page's panels go (design wave CAMP-7, C-15): from the click on the run dialog's action until
// the reply, the action is disabled, so a double click starts one run, for a picture run and a
// video run. The cost line is on screen at that click; nothing is sent before it. Holds the
// cases of the campaign page's generate-panel-click test.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { Result } from '@/shared/schemas/result'
import { renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { costLine } from '../cost-line'
import { REFUSED, heldReply } from '../screens/campaign/held-reply'
import { ref } from '../screens/campaign/reference-fixture'
import { LOGO, P, variantGet } from './editor-fixture'
import { WITH_FAL, openDialog, openVideo } from './generate-panel-video-fixture'

const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J5' } }
const REPLIES = [
  ['a start', STARTED],
  ['a refusal', REFUSED],
] as const

beforeEach(() => generateDrafts.setState({ drafts: {}, wanted: {} }))

async function openPictures() {
  const fake = campaignApi()
  const held = heldReply()
  fake.onQuery('asset.list', () => ({ ok: true, data: [ref('R2')] }))
  fake.onQuery('variant.get', () => ({ ok: true, data: variantGet() }))
  fake.onCommand('generation.runImages', held.answer)
  await renderApp(
    <main>
      <GenerateFields projectId={P} campaignId="C1" layer={LOGO} />
    </main>,
    fake,
  )
  await screen.findByText(/^(None|\d+) chosen$/)
  await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
  return { fake, held, dialog }
}

describe('a picture run from the Generate panel, one run per click [TL-2, C-15]', () => {
  it('shows the cost at the click, and sends nothing before it', async () => {
    const { fake, dialog } = await openPictures()
    expect(dialog.getByText(costLine('Paid: 4 pictures → Google Gemini'))).toBeVisible()
    expect(sent(fake, 'generation.runImages')).toEqual([])
  })

  for (const [name, reply] of REPLIES) {
    it(`sends one run for two clicks on the dialog's Generate, until ${name}`, async () => {
      const { fake, held, dialog } = await openPictures()
      const generate = dialog.getByRole('button', { name: 'Generate' })
      await userEvent.dblClick(generate)
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
      expect(generate).toBeDisabled()
      held.release(reply)
      if (reply.ok) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      else await waitFor(() => expect(generate).toBeEnabled())
      expect(sent(fake, 'generation.runImages')).toHaveLength(1)
    })
  }

  it('asks again after a start: the next Generate… sends nothing until its own click', async () => {
    const { fake, held, dialog } = await openPictures()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    held.release(STARTED)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const again = within(await screen.findByRole('dialog', { name: 'Make pictures' }))
    expect(again.getByText(costLine('Paid: 4 pictures → Google Gemini'))).toBeVisible()
    expect(sent(fake, 'generation.runImages')).toHaveLength(1)
  })
})

describe('a video run from the Generate panel, one run per click [TL-2, C-15]', () => {
  for (const [name, reply] of REPLIES) {
    it(`sends one paid video for two clicks on the dialog's Generate, until ${name}`, async () => {
      const { fake } = await openVideo({ providers: WITH_FAL, video: 'fal-seedance' })
      const held = heldReply()
      fake.onCommand('generation.startVideo', held.answer)
      const dialog = await openDialog()
      expect(dialog.getByText(costLine('Paid: 1 video, 4 seconds → fal.ai Seedance'))).toBeVisible()
      const generate = dialog.getByRole('button', { name: 'Generate' })
      await waitFor(() => expect(generate).toBeEnabled())
      expect(sent(fake, 'generation.startVideo')).toEqual([])
      await userEvent.dblClick(generate)
      expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
      expect(generate).toBeDisabled()
      held.release(reply)
      if (reply.ok) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      else await waitFor(() => expect(generate).toBeEnabled())
      expect(sent(fake, 'generation.startVideo')).toHaveLength(1)
    })
  }
})
