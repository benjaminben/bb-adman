// SH-3 (spec/phases/design-wave-screens-a.md, "SH-3 — The project menu"): the switcher shows
// the shown project's name and, with two or more open, a count chip "{n}" whose hidden words
// make "{n} projects open". The menu holds a row per open project (choose shows it; "Close
// {name}" closes it through the same close path), then "Package…", "Open…", "Start screen".
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActivityScope } from '@/renderer/app/activity-panel'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const TWO = [
  { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' },
  { projectId: 'P2', name: 'Winter', filePath: '/w/Winter.adman' },
]

async function draw(shown: string | null = 'P1', running = false) {
  const fake = makeFakeApi(baseState({ openProjects: TWO }))
  const rows = running ? [jobRow('J1', { status: 'running' })] : []
  fake.onQuery('job.activity', () => ({
    ok: true,
    data: rows.map((job) => ({
      job,
      place: { campaignName: null, variantLabel: null, layerName: null },
    })),
  }))
  const view = await renderApp(
    <ActivityScope projectId={shown}>
      <header>
        <ProjectSwitcher />
      </header>
    </ActivityScope>,
    fake,
  )
  const next = shown ? { kind: 'project' as const, projectId: shown } : { kind: 'start' as const }
  act(() => view.store.getState().show(next))
  return { ...view, fake }
}

const button = (name: string) => screen.getByRole('button', { name })
const names = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((i) => i.getAttribute('aria-label') ?? i.textContent)

describe('the project menu [SH-3]', () => {
  it('names the button "Summer 2 projects open" and shows the count as a chip', async () => {
    await draw()
    const switcher = button('Summer 2 projects open')
    expect(switcher).toHaveAttribute('aria-haspopup', 'menu')
    expect(switcher).toHaveAttribute('title', '2 projects open')
    expect(switcher).not.toHaveTextContent('·')
    expect(within(switcher).getByText('2')).toBeVisible()
  })

  it('lists a row and a close per project, then Package…, Open…, Start screen', async () => {
    await draw()
    await userEvent.click(button('Summer 2 projects open'))
    expect(names()).toEqual([
      'Summer',
      'Close Summer',
      'Winter',
      'Close Winter',
      'Package…',
      'Open…',
      'Start screen',
    ])
    expect(within(screen.getByRole('menu')).getByRole('separator')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Summer' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('menuitem', { name: 'Winter' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('menu')).not.toHaveTextContent('/w/')
  })

  it('reaches every item with the arrow keys and wraps', async () => {
    await draw()
    await userEvent.click(button('Summer 2 projects open'))
    const all = within(screen.getByRole('menu')).getAllByRole('menuitem')
    expect(all[0]).toHaveFocus()
    for (const next of [...all.slice(1), all[0]]) {
      await userEvent.keyboard('{ArrowDown}')
      expect(next).toHaveFocus()
    }
    await userEvent.keyboard('{ArrowUp}')
    expect(all[all.length - 1]).toHaveFocus()
  })

  it('"Close Winter" closes Winter while Summer is shown', async () => {
    const { fake, store } = await draw()
    await userEvent.click(button('Summer 2 projects open'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Close Winter' }))
    expect(fake.commands).toContainEqual({ name: 'project.close', input: { projectId: 'P2' } })
    expect(store.getState().view).toEqual({ kind: 'project', projectId: 'P1' })
  })

  it('"Package…" opens the package dialog for the shown project', async () => {
    await draw()
    await userEvent.click(button('Summer 2 projects open'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Package…' }))
    expect(screen.getByRole('dialog', { name: 'Package project' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('has no Package… on the start screen', async () => {
    await draw(null)
    await userEvent.click(button('AdManager 2 projects open'))
    expect(names()).toEqual([
      'Summer',
      'Close Summer',
      'Winter',
      'Close Winter',
      'Open…',
      'Start screen',
    ])
  })

  it('"Open…" sends the picker then project.open', async () => {
    const { fake } = await draw()
    fake.onQuery('dialog.pickProjectFile', () => ({ ok: true, data: { path: '/w/Autumn.adman' } }))
    await userEvent.click(button('Summer 2 projects open'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open…' }))
    expect(fake.queries.map((q) => q.name)).toContain('dialog.pickProjectFile')
    expect(fake.commands).toContainEqual({
      name: 'project.open',
      input: { filePath: '/w/Autumn.adman' },
    })
  })

  it('shows a Running spinner on the shown project while a job runs', async () => {
    await draw('P1', true)
    await userEvent.click(button('Summer 2 projects open'))
    const menu = screen.getByRole('menu')
    expect(await within(menu).findAllByTitle('Running')).toHaveLength(1)
  })

  it('shows no spinner when nothing runs', async () => {
    await draw('P1', false)
    await userEvent.click(button('Summer 2 projects open'))
    expect(within(screen.getByRole('menu')).queryByTitle('Running')).toBeNull()
  })

  it('has no accessibility violations with the menu open', async () => {
    await draw('P1', true)
    await userEvent.click(button('Summer 2 projects open'))
    await within(screen.getByRole('menu')).findByTitle('Running')
    expect(await axeViolations()).toEqual([])
  })
})
