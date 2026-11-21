import { describe, it, expect } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '../../../../../src/renderer/screens/project-home/project-home'
import { renderApp, axeViolations } from '../../render'
import { PROJECT, campaign, projectApi, projectGet } from './project-fixture'

const twoCampaigns = projectGet([
  campaign('summer-k3f9q2', 'Summer'),
  campaign('fall-a2b3c4', 'Fall'),
])

function changed(projectId: string) {
  return { projectId, actor: 'user' as const, changed: {}, removed: {} }
}

const projectGets = (fake: ReturnType<typeof projectApi>) =>
  fake.queries.filter((q) => q.name === 'project.get')

describe('project page [SPEC 14 1.41 TP-1]', () => {
  it('reads project.get for its own project', async () => {
    const fake = projectApi()
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaign yet.')
    expect(projectGets(fake)).toEqual([{ name: 'project.get', input: { projectId: 'P1' } }])
  })

  it('shows a loading line before project.get answers', async () => {
    const fake = projectApi()
    fake.onQuery('project.get', () => new Promise(() => {}))
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    expect(screen.getByText('Loading the project…')).toBeInTheDocument()
  })

  it('shows one line and the Load a brief button for an empty project', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi())
    expect(await screen.findByText('No campaign yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load a brief' })).toBeInTheDocument()
  })

  it('lists each campaign by name with an Open button', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(twoCampaigns))
    const list = await screen.findByRole('list', { name: 'Campaigns' })
    expect(list).toHaveTextContent('Summer')
    expect(list).toHaveTextContent('Fall')
    expect(screen.getByRole('button', { name: 'Open Fall' })).toBeInTheDocument()
    expect(screen.queryByText('No campaign yet.')).toBeNull()
  })

  it('keeps the heading, the Close project button and the file path', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi())
    expect(screen.getByRole('heading', { name: 'Summer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close Summer' })).toBeInTheDocument()
    expect(screen.getByText('/w/Summer.adman')).toBeInTheDocument()
  })

  it('reads project.get again on a project.changed for this project', async () => {
    const fake = projectApi()
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaign yet.')
    fake.onQuery('project.get', () => ({ ok: true, data: twoCampaigns }))
    act(() => fake.emit('project.changed', changed('P1')))
    expect(await screen.findByRole('button', { name: 'Open Summer' })).toBeInTheDocument()
    expect(projectGets(fake)).toHaveLength(2)
  })

  it('does not read project.get on a project.changed for another project', async () => {
    const fake = projectApi()
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaign yet.')
    act(() => fake.emit('project.changed', changed('P2')))
    await waitFor(() => expect(projectGets(fake)).toHaveLength(1))
  })

  it('stops listening for project.changed once it is gone', async () => {
    const fake = projectApi()
    const view = await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaign yet.')
    view.unmount()
    act(() => fake.emit('project.changed', changed('P1')))
    expect(projectGets(fake)).toHaveLength(1)
  })

  it('shows the campaign place on Open and returns on Back to project', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(twoCampaigns))
    await userEvent.click(await screen.findByRole('button', { name: 'Open Summer' }))
    expect(screen.getByText('Campaign page: not built yet')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Campaigns' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Back to project' }))
    expect(await screen.findByRole('list', { name: 'Campaigns' })).toBeInTheDocument()
    expect(screen.queryByText('Campaign page: not built yet')).toBeNull()
  })

  it('opens a campaign by keyboard', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(twoCampaigns))
    const open = await screen.findByRole('button', { name: 'Open Summer' })
    open.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('Campaign page: not built yet')).toBeInTheDocument()
  })

  it('gives the campaign place the project ID and the opened campaign ID [TP-1 review F6]', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(twoCampaigns))
    await userEvent.click(await screen.findByRole('button', { name: 'Open Fall' }))
    const place = screen.getByRole('region', { name: 'Campaign' })
    expect(place).toHaveAttribute('data-project-id', 'P1')
    expect(place).toHaveAttribute('data-campaign-id', 'fall-a2b3c4')
  })

  it('draws a campaign name as text, not as HTML', async () => {
    const reply = projectGet([campaign('x-k3f9q2', '<a href="https://e.test">Click</a>')])
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(reply))
    const list = await screen.findByRole('list', { name: 'Campaigns' })
    expect(list).toHaveTextContent('<a href="https://e.test">Click</a>')
    expect(list.querySelector('a')).toBeNull()
  })

  it('has no axe violations with campaigns listed', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi(twoCampaigns))
    await screen.findByRole('list', { name: 'Campaigns' })
    expect(await axeViolations()).toEqual([])
  })
})
