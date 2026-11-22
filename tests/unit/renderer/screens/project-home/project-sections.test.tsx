import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp, axeViolations } from '../../render'
import { PROJECT, projectApi } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

const CREATED = { campaignId: 'summer-splash-k3f9q2', directionId: 'D1', variantId: 'V1' }

describe('project home sections [spec/screens-campaign.md, Project home]', () => {
  it('puts "Load a brief" inside the Campaigns Section [HOME-1]', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi())
    await screen.findByText('No campaigns yet')
    const campaigns = screen.getByRole('region', { name: 'Campaigns' })
    expect(within(campaigns).getByRole('button', { name: 'Load a brief' })).toBeInTheDocument()
  })

  it('opens the new campaign after "Create campaign" succeeds [A-45]', async () => {
    const fake = photoStubs(projectApi())
    fake.onCommand('campaign.create', () => ({ ok: true, data: CREATED }))
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaigns yet')
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await addPhotos(await screen.findByRole('region', { name: 'New campaign' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(await screen.findByRole('button', { name: 'Back to project' })).toBeInTheDocument()
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'campaign.get')).toEqual([
        { name: 'campaign.get', input: { projectId: 'P1', campaignId: CREATED.campaignId } },
      ]),
    )
  })

  it('has no axe violations with the sections shown', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi())
    await screen.findByText('No campaigns yet')
    expect(await axeViolations()).toEqual([])
  })
})
