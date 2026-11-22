// spec/screens-ai.md, "Attached jobs and the close warning": the project page's own "Close
// project" button asks "Close {project}?" when project.close refuses with jobs_running, as the
// project switcher does; "Stop and close" sends project.close with runningJobs 'stop'.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { PROJECT, projectApi } from './project-fixture'

async function draw(running: number) {
  const fake = projectApi()
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
  const view = await renderApp(<ProjectHome project={PROJECT} />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Close Summer' }))
  return view
}

const closes = (fake: Awaited<ReturnType<typeof draw>>['fake']) =>
  fake.commands.filter((c) => c.name === 'project.close').map((c) => c.input)

describe('the project page closes with runs going [spec/screens-ai.md, D-036]', () => {
  it('closes at once with no warning when nothing runs', async () => {
    const { fake } = await draw(0)
    expect(closes(fake)).toEqual([{ projectId: 'P1' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks "Close Summer?" and sends stop on "Stop and close", with no refusal shown', async () => {
    const { fake, store } = await draw(2)
    const dialog = await screen.findByRole('dialog', { name: 'Close Summer?' })
    expect(dialog).toHaveAccessibleDescription(/^2 runs are still going in this project\./)
    expect(store.getState().error).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Stop and close' }))
    expect(closes(fake)).toEqual([{ projectId: 'P1' }, { projectId: 'P1', runningJobs: 'stop' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
