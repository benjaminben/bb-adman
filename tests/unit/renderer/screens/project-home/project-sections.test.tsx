import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp, axeViolations } from '../../render'
import { PROJECT, projectApi } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

const CREATED = { campaignId: 'summer-splash-k3f9q2', directionId: 'D1', variantId: 'V1' }

describe('project home sections [spec/screens-campaign.md, Project home]', () => {
  it('shows "Start a campaign", "Files" and "Package" after the campaign list', async () => {
    await renderApp(<ProjectHome project={PROJECT} />, projectApi())
    await screen.findByText('No campaign yet.')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Campaigns', 'Start a campaign', 'Assets', 'Package'])
    const empty = screen.getByText('No campaign yet.')
    const start = screen.getByRole('heading', { name: 'Start a campaign' })
    expect(empty.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens the new campaign after "Create campaign" succeeds [A-45]', async () => {
    const fake = photoStubs(projectApi())
    fake.onCommand('campaign.create', () => ({ ok: true, data: CREATED }))
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    await screen.findByText('No campaign yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await addPhotos(await screen.findByRole('region', { name: 'Brief' }))
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
    await screen.findByText('No campaign yet.')
    expect(await axeViolations()).toEqual([])
  })
})
