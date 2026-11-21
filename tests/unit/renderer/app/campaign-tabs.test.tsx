// spec/editor.md, "The shell" [FR-211, FR-218]: a fixed "Project" tab, then one tab per open
// campaign named after it with a close button and its job marks, then the "+" button.
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignTabs, useCampaignTab } from '@/renderer/app/campaign-tabs'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations, renderApp } from '../render'
import { campaign, projectApi, projectGet } from '../screens/project-home/project-fixture'

const SUMMER = campaign('C1', 'Summer Splash')
const FALL = campaign('C2', 'Fall Harvest')

// Opens the given campaigns once, as the project page would.
function Shell(props: { open: string[] }) {
  const nav = useNavStore()
  useEffect(() => {
    for (const id of props.open) nav.getState().openCampaign('P1', id)
  }, [nav, props.open])
  const tab = useCampaignTab('P1')
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange}>
      <CampaignTabs projectId="P1" />
      <Tabs.Content value={tab.value}>{`Showing ${tab.value}`}</Tabs.Content>
    </Tabs.Root>
  )
}

async function draw(campaigns: CampaignSummary[] = [SUMMER, FALL], open = ['C1', 'C2']) {
  const fake = projectApi(projectGet(campaigns))
  const view = await renderApp(
    <main>
      <NavScope>
        <Shell open={open} />
      </NavScope>
    </main>,
    fake,
  )
  await screen.findByRole('tab', { name: 'Fall Harvest' })
  return { ...view, fake }
}

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Open campaigns' }))
    .getAllByRole('tab')
    .map((t) => t.textContent)

describe('campaign tabs [FR-211]', () => {
  it('shows Project, then one tab per open campaign named after it', async () => {
    await draw()
    expect(tabs()).toEqual(['Project', 'Summer Splash', 'Fall Harvest'])
    expect(screen.getByRole('tab', { name: 'Fall Harvest' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows a tab by click, and Project shows the project home', async () => {
    await draw()
    await userEvent.click(screen.getByRole('tab', { name: 'Summer Splash' }))
    expect(screen.getByText('Showing C1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Project' }))
    expect(screen.getByText('Showing project')).toBeInTheDocument()
  })

  it('closes a campaign tab with its close button and sends no command', async () => {
    const { fake } = await draw()
    const before = fake.commands.length
    await userEvent.click(screen.getByRole('button', { name: 'Close Fall Harvest' }))
    expect(tabs()).toEqual(['Project', 'Summer Splash'])
    expect(screen.getByText('Showing C1')).toBeInTheDocument()
    expect(fake.commands).toHaveLength(before)
  })

  it('"+" shows the Project tab', async () => {
    await draw()
    await userEvent.click(screen.getByRole('button', { name: 'Open or start a campaign' }))
    expect(screen.getByText('Showing project')).toBeInTheDocument()
    expect(tabs()).toEqual(['Project', 'Summer Splash', 'Fall Harvest'])
  })

  it.each([
    ['a running job', { jobRunning: true }, 'Running'],
    ['a result not looked at', { resultUnseen: true }, 'New result'],
  ])('marks a tab with %s [FR-218]', async (_, marks, word) => {
    await draw([{ ...SUMMER, ...marks }, FALL])
    expect(screen.getByRole('tab', { name: `Summer Splash ${word}` })).toBeInTheDocument()
  })

  it('drops the tab of a campaign that is gone', async () => {
    const { fake } = await draw()
    fake.onQuery('project.get', () => ({ ok: true, data: projectGet([SUMMER]) }))
    act(() =>
      fake.emit('project.changed', { projectId: 'P1', actor: 'user', changed: {}, removed: {} }),
    )
    await waitFor(() => expect(tabs()).toEqual(['Project', 'Summer Splash']))
  })

  it('has no accessibility violations', async () => {
    await draw([{ ...SUMMER, jobRunning: true }, FALL])
    expect(await axeViolations()).toEqual([])
  })
})
