// SH-5 (spec/phases/design-wave-screens-a.md, "SH-5 — One close question"): the tab, variant
// tab and project close questions share one look: a confirm dialog of the normal width, "Keep
// open" (quiet, focused) then "Stop and close" (primary) in the foot. The charge line and the
// lost-work words are visible and are the dialog's accessible description. Nothing is sent
// before "Stop and close", which sends what it sent before, once.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { attachedStoreFor, variantJobs } from '@/renderer/stores/attached-store'
import frame from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import layout from '@/renderer/ui/layout.module.css'
import type { JobRow } from '@/shared/schemas/rows/job'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const PAID = 'A request already sent may still be charged.'
const SUMMER = { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }
const LOST =
  '1 run is still going in this project. Closing stops it. Requests already sent to a paid ' +
  'provider may still be charged, and their results are lost.'
const LEFT =
  'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the ' +
  'project again to collect it.'

function Harness(props: { onClosed: () => void }) {
  const { ask, warning } = useCloseWarning('tab')
  return (
    <main>
      <h1>Campaign</h1>
      <button
        type="button"
        onClick={() => ask((s) => variantJobs(s, 'P1', ['V1']), props.onClosed)}
      >
        Close tab
      </button>
      {warning}
    </main>
  )
}

async function askTab(provider: string) {
  const fake = makeFakeApi(baseState())
  attachedStoreFor(fake.api).getState().register('J1', { projectId: 'P1', variantId: 'V1' })
  const row = jobRow('J1', { kind: 'copy_options', provider, status: 'running' })
  act(() => fake.emit('job.updated', row))
  const onClosed = vi.fn()
  await renderApp(<Harness onClosed={onClosed} />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Close tab' }))
  const dialog = screen.getByRole('dialog', { name: 'Stop writing copy options?' })
  return { fake, onClosed, dialog }
}

const video = (id: string, over: Partial<JobRow> = {}) =>
  jobRow(id, {
    kind: 'video_generation',
    status: 'running',
    provider: 'fal-seedance',
    remoteJobId: `r-${id}`,
    result: { stage: 'working' },
    ...over,
  })

async function askProject() {
  const rows = [video('a'), jobRow('b', { status: 'running' })]
  const fake = makeFakeApi(baseState({ openProjects: [SUMMER] }))
  fake.onCommand('project.close', (input) =>
    (input as { runningJobs?: string }).runningJobs === 'stop'
      ? { ok: true, data: { projectId: 'P1' } }
      : {
          ok: false,
          error: {
            code: 'RULE_VIOLATION',
            message: 'Work is still running in this project. Stop it, or wait for it to finish.',
            details: { reason: 'jobs_running', count: rows.length },
          },
        },
  )
  fake.onQuery('job.activity', () => ({
    ok: true,
    data: rows.map((job) => ({
      job,
      place: { campaignName: null, variantLabel: null, layerName: null },
    })),
  }))
  const view = await renderApp(
    <header>
      <ProjectSwitcher />
    </header>,
    fake,
  )
  act(() => view.store.getState().show({ kind: 'project', projectId: 'P1' }))
  await userEvent.click(screen.getByRole('button', { name: 'Summer' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Close Summer' }))
  const dialog = await screen.findByRole('dialog', { name: 'Close Summer?' })
  return { fake, dialog }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

function expectOneLook(dialog: HTMLElement) {
  expect(dialog).toHaveClass(frame.normal as string)
  const buttons = within(dialog).getAllByRole('button')
  expect(buttons.map((b) => b.textContent)).toEqual(['Keep open', 'Stop and close'])
  const [keep, stop] = buttons
  expect(keep).toHaveClass(layout.quiet as string)
  expect(stop).toHaveClass(layout.primary as string)
  expect(keep?.parentElement).toHaveClass(frame.foot as string)
  expect(keep).toHaveFocus()
}

describe('one close question [SH-5]', () => {
  it('a tab with a paid task: the shared look, the paid line visible and as the description', async () => {
    const { dialog } = await askTab('gemini')
    expectOneLook(dialog)
    expect(within(dialog).getByText(PAID)).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(PAID)
    expect(dialog).not.toHaveTextContent('is still running')
  })

  it('a tab with a local task has no paid line and no sentence repeating the title', async () => {
    const { dialog } = await askTab('fake')
    expectOneLook(dialog)
    expect(dialog).toHaveAccessibleDescription('')
    expect(dialog).not.toHaveTextContent(PAID)
    expect(dialog).not.toHaveTextContent('Closing this tab')
  })

  it('a project: the shared look, the lost-work words and the left-running line', async () => {
    const { dialog } = await askProject()
    expectOneLook(dialog)
    expect(within(dialog).getByText(`${LOST} ${LEFT}`)).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(`${LOST} ${LEFT}`)
  })

  it('Escape keeps a tab open and sends nothing', async () => {
    const { fake, onClosed } = await askTab('gemini')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClosed).not.toHaveBeenCalled()
    expect(sent(fake, 'job.cancel')).toEqual([])
  })

  it('Escape keeps a project open and sends nothing more', async () => {
    const { fake } = await askProject()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'project.close')).toEqual([{ projectId: 'P1' }])
  })

  it('"Stop and close" on a tab sends job.cancel once', async () => {
    const { fake, onClosed, dialog } = await askTab('gemini')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop and close' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: 'P1', jobId: 'J1' }])
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('"Stop and close" on a project sends project.close with runningJobs stop once', async () => {
    const { fake, dialog } = await askProject()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop and close' }))
    expect(sent(fake, 'project.close')).toEqual([
      { projectId: 'P1' },
      { projectId: 'P1', runningJobs: 'stop' },
    ])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['tab', () => askTab('gemini')],
    ['project', askProject],
  ])('the %s question has no accessibility violations', async (_, ask) => {
    await ask()
    expect(await axeViolations()).toEqual([])
  })
})
