// SPEC 14 1.41 TP-2 "Variants": the campaign page loads campaign.get, lists the variants
// with the master chosen, and reads the chosen variant's runs.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../../shared/scene/fake-fonts'
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
    const master = await screen.findByRole('button', { name: /^Master post/ })
    expect(master).toHaveAttribute('aria-pressed', 'true')
    expect(within(master).getByText('1080×1080 · en · image · master')).toBeInTheDocument()
    // Four buttons: each tile's own button, then its "+" ("Open {title} in a tab", P3-10).
    const tiles = within(screen.getByRole('list', { name: 'Variants' })).getAllByRole('button')
    expect(tiles.map((t) => within(t).queryByText(/(Master|German) post/)?.textContent)).toEqual([
      'Master post',
      undefined,
      'German post',
      undefined,
    ])
  })

  it('reads job.list for the chosen variant, and again when another is chosen', async () => {
    const { fake } = await renderWith(view())
    await userEvent.click(await screen.findByRole('button', { name: /^German post/ }))
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
    await screen.findByRole('button', { name: /^Master post/ })
    expect(await axeViolations()).toEqual([])
  })

  it('names the chosen variant above the panels, and follows a new choice [S2-16]', async () => {
    await renderWith(view())
    const line = 'Runs and panels below are for: '
    expect(await screen.findByText(`${line}Master post · 1:1 · en`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^German post/ }))
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(await screen.findByText(`${line}German post · 1:1 · de`)).toBeInTheDocument()
  })

  it('opens a variant in the editor on a plain click, in place of the overview [P3-9, A-47]', async () => {
    const { fake } = await renderWith(view())
    await userEvent.click(await screen.findByRole('button', { name: /^German post/ }))
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'variant.get').map((q) => q.input)).toEqual([
        { projectId: P, variantId: 'V2' },
      ]),
    )
    expect(screen.getByText('Loading the variant…')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Variants' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Make pictures' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('button', { name: /^German post/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByText('Runs and panels below are for: German post · 1:1 · de'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to overview' })).toBeNull()
  })
})
