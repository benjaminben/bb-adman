// SPEC 14 1.41 TP-2 "Variants": the campaign page loads campaign.get, lists the variants
// with the master chosen, and reads the chosen variant's runs.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { axeViolations } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { P, campaignApi, renderWith } from './campaign-fixture'

const view = (onBack = () => {}) => <CampaignView projectId={P} campaignId="C1" onBack={onBack} />

describe('CampaignView [SPEC 14 1.41 TP-2]', () => {
  it('reads campaign.get for this campaign and shows its name', async () => {
    const { fake } = await renderWith(view())
    expect(await screen.findByRole('heading', { name: 'Summer Splash' })).toBeInTheDocument()
    expect(fake.queries.find((q) => q.name === 'campaign.get')?.input).toEqual({
      projectId: P,
      campaignId: 'C1',
    })
  })

  it('lists each variant with its size, language, format, and the master first and chosen', async () => {
    await renderWith(view())
    const master = await screen.findByRole('radio', { name: /Master post/ })
    expect(master).toBeChecked()
    expect(master).toHaveAccessibleName('Master post · 1080×1080 (1:1) · en · image · master')
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['V1', 'V2'])
  })

  it('reads job.list for the chosen variant, and again when another is chosen', async () => {
    const { fake } = await renderWith(view())
    await userEvent.click(await screen.findByRole('radio', { name: /German post/ }))
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'job.list').map((q) => q.input)).toEqual([
        { projectId: P, variantId: 'V1' },
        { projectId: P, variantId: 'V2' },
      ]),
    )
  })

  it('changes a known run when job.updated arrives, and reads job.list for an unknown one', async () => {
    const fake = campaignApi({ jobs: [jobRow('J1')] })
    await renderWith(view(), fake)
    expect(await screen.findByText('Waiting')).toBeInTheDocument()
    fake.emit('job.updated', jobRow('J1', { status: 'running' }))
    expect(await screen.findByText('Working')).toBeInTheDocument()
    const lists = () => fake.queries.filter((q) => q.name === 'job.list').length
    expect(lists()).toBe(1)
    fake.emit('job.updated', jobRow('J7', { variantId: 'V9' }))
    await waitFor(() => expect(lists()).toBe(2))
  })

  it('goes back to the project', async () => {
    const onBack = vi.fn()
    await renderWith(view(onBack))
    await userEvent.click(await screen.findByRole('button', { name: 'Back to project' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    await renderWith(view())
    await screen.findByRole('radio', { name: /Master post/ })
    expect(await axeViolations()).toEqual([])
  })
})
