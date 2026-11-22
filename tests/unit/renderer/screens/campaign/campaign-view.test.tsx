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
    // Seven buttons: each tile's own button, then its "+" ("Open {title} in a tab", P3-10),
    // "Quick look at {title}" and, except on the master, "Delete {title}" (P5-15).
    const tiles = within(screen.getByRole('list', { name: 'Variants in Main' })).getAllByRole(
      'button',
    )
    expect(tiles.map((t) => within(t).queryByText(/(Master|German) post/)?.textContent)).toEqual([
      'Master post',
      undefined,
      undefined,
      'German post',
      undefined,
      undefined,
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
    await userEvent.dblClick(screen.getByRole('button', { name: /^German post/ }))
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(await screen.findByText(`${line}German post · 1:1 · de`)).toBeInTheDocument()
  })

  it('opens a variant in the editor on a double-click, in place of the overview [P3-9, A-47]', async () => {
    const { fake } = await renderWith(view())
    await userEvent.dblClick(await screen.findByRole('button', { name: /^German post/ }))
    // The "Make a video" card reads its own post too (P7-22), so only V2's reads are counted.
    const readsOfV2 = () =>
      fake.queries
        .filter((q) => q.name === 'variant.get')
        .map((q) => q.input as { projectId: string; variantId: string })
        .filter((input) => input.variantId === 'V2')
    await waitFor(() => expect(readsOfV2()).toContainEqual({ projectId: P, variantId: 'V2' }))
    expect(screen.getByText('Loading the variant…')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Variants in Main' })).toBeNull()
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

  it('keeps the chosen view while a variant tab is shown and back again [R2C-1, A-303]', async () => {
    await renderWith(view())
    await userEvent.dblClick(await screen.findByRole('button', { name: /^German post/ }))
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Checks' }))
    expect(screen.getByRole('region', { name: 'Checks' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'German post · 1:1 · de' }))
    expect(screen.queryByRole('tab', { name: 'Checks' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Checks' })).toBeInTheDocument()
  })

  it('a click selects: the line names it, job.list is read for it, no tab opens [R2C-3]', async () => {
    const { fake } = await renderWith(view())
    await userEvent.click(await screen.findByRole('button', { name: /^German post/ }))
    expect(
      await screen.findByText('Runs and panels below are for: German post · 1:1 · de'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'job.list').at(-1)?.input).toEqual({
        projectId: P,
        variantId: 'V2',
      }),
    )
    expect(screen.queryByRole('tab', { name: 'German post · 1:1 · de' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Variants in Main' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^German post/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('a double-click opens the editor in place of the overview and keeps it selected [R2C-3]', async () => {
    await renderWith(view())
    await userEvent.dblClick(await screen.findByRole('button', { name: /^German post/ }))
    expect(screen.getByRole('tab', { name: 'German post · 1:1 · de' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('list', { name: 'Variants in Main' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('button', { name: /^German post/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('says once, above the grids, how to select and open a post [R2C-3]', async () => {
    await renderWith(view())
    const hint = await screen.findByText(
      'Click a post to select it. Double-click it, or press Enter, to open it.',
    )
    expect(hint.compareDocumentPosition(screen.getByRole('region', { name: 'Main' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})
