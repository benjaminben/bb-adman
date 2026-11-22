// Lows C: the publish dialog's warnings step. "Publish anyway" stays disabled for 500 ms after
// the step opens, so a double click on "Publish" cannot land on it; a click while disabled sends
// nothing. "Back" reads publish.inspect again before showing the first step.
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublishDialog } from '@/renderer/dialogs/publish-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { campaignGet } from '../screens/campaign/campaign-fixture'
import { PUBLISHED, inspectReply } from './publish-fixture'

const WARNED: Result<unknown> = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'Some ads have warnings. Fix them or publish anyway.',
    details: {
      reason: 'publish_has_warnings',
      warnings: [{ variantId: 'V2', title: 'Text overflow', message: 'Runs past its box.' }],
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const flush = () => act(async () => undefined)
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const anyway = () => screen.getByRole('button', { name: 'Publish anyway' })
const runs = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'publish.run')
const inspects = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'publish.inspect')

// Opens the step with fake timers from the "Publish" click on.
async function openWarned(warned = 1) {
  const fake = makeFakeApi()
  fake.onQuery('publish.inspect', (input) => ({
    ok: true,
    data: inspectReply({
      existing: (input as { storage: string | null }).storage === null ? null : PUBLISHED,
    }),
  }))
  fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet([]) }))
  const sends = Array.from({ length: warned }, () => WARNED)
  fake.onCommand('publish.run', () => sends.shift() ?? { ok: true, data: { jobId: 'job1' } })
  const view = await renderApp(
    <PublishDialog
      projectId="p1"
      campaignId="01JD00000000000000000000CA"
      campaignName="Summer Launch"
      onClose={() => undefined}
    />,
    fake,
  )
  await userEvent.click(await screen.findByRole('radio', { name: 'Amazon S3' }))
  await userEvent.click(await screen.findByRole('switch', { name: 'Replace the published files' }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const timers = { set: vi.spyOn(globalThis, 'setTimeout') }
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
  await flush()
  await flush()
  expect(screen.getByRole('list', { name: 'These ads have warnings' })).toBeInTheDocument()
  return { fake, unmount: view.unmount, timers }
}

describe('"Publish anyway" waits 500 ms [lows C]', () => {
  it('is disabled at 0 ms and 499 ms and enabled at 500 ms', async () => {
    await openWarned()
    expect(anyway()).toBeDisabled()
    wait(499)
    expect(anyway()).toBeDisabled()
    wait(1)
    expect(anyway()).toBeEnabled()
  })

  it('sends nothing when clicked while disabled, and publish.run once when clicked after', async () => {
    const { fake } = await openWarned()
    fireEvent.click(anyway())
    wait(250)
    fireEvent.click(anyway())
    await flush()
    expect(runs(fake)).toHaveLength(1)
    wait(250)
    fireEvent.click(anyway())
    await flush()
    expect(runs(fake)).toHaveLength(2)
    expect(runs(fake)[1]?.input).toMatchObject({ proceedDespiteWarnings: true })
  })

  it('starts the wait again when the step opens again', async () => {
    await openWarned(2)
    wait(500)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await flush()
    await flush()
    fireEvent.click(screen.getByRole('switch', { name: 'Replace the published files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await flush()
    expect(anyway()).toBeDisabled()
    wait(500)
    expect(anyway()).toBeEnabled()
  })

  it('"Back" reads publish.inspect once more before the first step shows', async () => {
    const { fake } = await openWarned()
    const before = inspects(fake).length
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(inspects(fake)).toHaveLength(before + 1)
    expect(inspects(fake).at(-1)?.input).toMatchObject({ storage: 's3' })
    await flush()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(runs(fake)).toHaveLength(1)
  })

  it('clears its timer when the dialog closes', async () => {
    const { unmount, timers } = await openWarned()
    const cleared = vi.spyOn(globalThis, 'clearTimeout')
    const set = timers.set
    const index = set.mock.calls.findIndex((call) => call[1] === 500)
    const timer = set.mock.results[index]?.value as unknown
    expect(timer).toBeDefined()
    unmount()
    expect(cleared).toHaveBeenCalledWith(timer)
  })
})
