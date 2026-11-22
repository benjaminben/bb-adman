// P9-13 (spec/phases/phase-09.md "Screens", "Publishing"): the publish dialog's warnings step.
// On publish_has_warnings the warnings are listed as text, with an optional reason of at most
// 500 characters that is published in the report. "Publish anyway" is the user's own act: it
// sends publish.run again with proceedDespiteWarnings and the reason, and the replace tick of
// the first step as given. "Back" sends nothing.
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublishDialog } from '@/renderer/dialogs/publish-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { campaignGet, variant } from '../screens/campaign/campaign-fixture'
import { PUBLISHED, inspectReply } from './publish-fixture'

const STARTED =
  'Publishing has started. You can close this window and follow it in the activity list.'
const PUBLISHED_LINE = 'This reason is written into the published report.'

const WARNED: Result<unknown> = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'Some ads have warnings. Fix them or publish anyway.',
    details: {
      reason: 'publish_has_warnings',
      warnings: [
        { variantId: 'V2', title: 'Text overflow', message: 'The headline runs past its box.' },
        { variantId: 'V9', title: 'Prohibited words', message: '“<b>best</b>” is in the‮ text.' },
      ],
    },
  },
}

let store: Awaited<ReturnType<typeof renderApp>>['store']

async function openWarned(replies: Array<Result<unknown>> = []) {
  const fake = makeFakeApi()
  fake.onQuery('publish.inspect', (input) => ({
    ok: true,
    data: inspectReply({
      existing: (input as { storage: string | null }).storage === null ? null : PUBLISHED,
    }),
  }))
  fake.onQuery('campaign.get', () => ({
    ok: true,
    data: campaignGet([
      variant('V2', { title: 'Picnic table', sizeLabel: '9x16', language: 'de' }),
    ]),
  }))
  const sends = [WARNED, ...replies]
  fake.onCommand('publish.run', () => sends.shift() ?? { ok: true, data: { jobId: 'job1' } })
  ;({ store } = await renderApp(
    <PublishDialog
      projectId="p1"
      campaignId="01JD00000000000000000000CA"
      campaignName="Summer Launch"
      onClose={() => undefined}
    />,
    fake,
  ))
  await userEvent.click(await screen.findByRole('radio', { name: 'Amazon S3' }))
  await userEvent.click(await screen.findByRole('switch', { name: 'Replace the published files' }))
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
  await screen.findByRole('list', { name: 'These ads have warnings' })
  // The button waits 500 ms after the step opens, so a double click cannot land on it.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish anyway' })).toBeEnabled())
  return fake
}

const runs = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'publish.run').map((c) => c.input)
const reasonField = () => screen.getByRole('textbox', { name: 'Why publish anyway? (optional)' })
const anyway = () => screen.getByRole('button', { name: 'Publish anyway' })

describe('the publish warnings step [P9-13]', () => {
  it('lists the warnings as text, with the empty reason field and its published line', async () => {
    await openWarned()
    const list = screen.getByRole('list', { name: 'These ads have warnings' })
    const lines = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toEqual([
      'Picnic table · 9x16 · de · Text overflow: The headline runs past its box.',
      'Prohibited words: “<b>best</b>” is in the text.',
    ])
    expect(list.querySelector('b')).toBeNull()
    expect(reasonField()).toHaveValue('')
    expect(reasonField()).toHaveAccessibleDescription(PUBLISHED_LINE)
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
  })

  it('takes the warnings refusal out of the error banner', async () => {
    await openWarned()
    expect(store.getState().error).toBeNull()
  })

  it('caps the reason at 500 characters', async () => {
    await openWarned()
    expect(reasonField()).toHaveAttribute('maxLength', '500')
    await userEvent.click(reasonField())
    await userEvent.paste('x'.repeat(600))
    expect((reasonField() as HTMLInputElement).value).toHaveLength(500)
  })

  it('"Publish anyway" sends publish.run with proceedDespiteWarnings and the trimmed reason', async () => {
    const fake = await openWarned()
    await userEvent.type(reasonField(), '  Signed off by the client  ')
    await userEvent.click(anyway())
    await screen.findByText(STARTED)
    expect(runs(fake)).toEqual([
      {
        projectId: 'p1',
        campaignId: '01JD00000000000000000000CA',
        storage: 's3',
        replaceConfirmed: true,
        proceedDespiteWarnings: false,
      },
      {
        projectId: 'p1',
        campaignId: '01JD00000000000000000000CA',
        storage: 's3',
        replaceConfirmed: true,
        proceedDespiteWarnings: true,
        proceedReason: 'Signed off by the client',
      },
    ])
  })

  it('sends no reason when none is typed', async () => {
    const fake = await openWarned()
    await userEvent.click(anyway())
    await screen.findByText(STARTED)
    expect(runs(fake)[1]).not.toHaveProperty('proceedReason')
  })

  it('"Back" sends no publish.run and shows the first view again', async () => {
    const fake = await openWarned()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'These ads have warnings' })).toBeNull()
    expect(runs(fake)).toHaveLength(1)
  })

  it('shows a refusal of "Publish anyway" as its sentence and stays on the step', async () => {
    const message = 'This campaign is being published. Wait until it ends.'
    await openWarned([
      {
        ok: false,
        error: { code: 'RULE_VIOLATION', message, details: { reason: 'publish_running' } },
      },
    ])
    await userEvent.click(anyway())
    const alerts = await within(screen.getByRole('dialog')).findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toContain(message)
    expect(anyway()).toBeEnabled()
  })

  it('has no accessibility violations', async () => {
    await openWarned()
    expect(await axeViolations()).toEqual([])
  })
})
