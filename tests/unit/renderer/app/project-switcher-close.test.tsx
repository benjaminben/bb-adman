// spec/screens-ai.md, "Attached jobs and the close warning": "Close project" with any job queued
// or running (project.close refuses with jobs_running) shows "Close {project}?"; "Stop runs and
// close" sends project.close with runningJobs 'stop', "Keep open" sends nothing more.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

const SUMMER = { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }

async function draw(running: number) {
  const fake = makeFakeApi(baseState({ openProjects: [SUMMER] }))
  fake.onCommand('project.close', (input) =>
    running > 0 && (input as { runningJobs?: string }).runningJobs !== 'stop'
      ? {
          ok: false,
          error: {
            code: 'RULE_VIOLATION',
            message: 'Work is still running in this project. Stop it, or wait for it to finish.',
            details: { reason: 'jobs_running', count: running },
          },
        }
      : { ok: true, data: { projectId: 'P1' } },
  )
  const view = await renderApp(
    <header>
      <ProjectSwitcher />
    </header>,
    fake,
  )
  act(() => view.store.getState().show({ kind: 'project', projectId: 'P1' }))
  await userEvent.click(screen.getByRole('button', { name: 'Summer' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Close Summer' }))
  return { ...view, fake }
}

const closes = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'project.close').map((c) => c.input)

describe('closing a project with runs going [spec/screens-ai.md, D-036]', () => {
  it('closes at once with no warning when nothing runs', async () => {
    const { fake } = await draw(0)
    expect(closes(fake)).toEqual([{ projectId: 'P1' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    [1, '1 run is still going in this project. Closing stops it.'],
    [3, '3 runs are still going in this project. Closing stops them.'],
  ])('with %i runs asks "Close Summer?" with the count and the warning', async (n, start) => {
    const { store } = await draw(n)
    const dialog = await screen.findByRole('dialog', { name: 'Close Summer?' })
    expect(dialog).toHaveAccessibleDescription(
      `${start} Requests already sent to a paid provider may still be charged, and their ` +
        'results are lost.',
    )
    expect(screen.getByRole('button', { name: 'Keep open' })).toHaveFocus()
    expect(store.getState().error).toBeNull()
  })

  it('"Stop runs and close" sends project.close with runningJobs stop', async () => {
    const { fake, store } = await draw(2)
    await userEvent.click(await screen.findByRole('button', { name: 'Stop runs and close' }))
    expect(closes(fake)).toEqual([{ projectId: 'P1' }, { projectId: 'P1', runningJobs: 'stop' }])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.getState().error).toBeNull()
  })

  it('"Keep open" sends nothing more', async () => {
    const { fake } = await draw(2)
    await userEvent.click(await screen.findByRole('button', { name: 'Keep open' }))
    expect(closes(fake)).toEqual([{ projectId: 'P1' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await draw(2)
    await screen.findByRole('dialog')
    expect(await axeViolations()).toEqual([])
  })
})
