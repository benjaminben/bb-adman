// BB-7 (spec/brief-brand.md, "The brief form", "Loading", "Ad sets"; A-396): after the photos,
// each distinct brand path of brief.parse's brandFiles is imported once with copy: true; a role
// named by asset ID is kept with no import; a refused import gives its note. Cancel and the page
// going away remove every brand asset the form added. "Ad sets" shows with two subject rows and
// its value reaches campaign.create.
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import {
  ALL_FILES,
  BODY,
  HEADING,
  LOGO,
  brandApi,
  openBrandForm,
  openBrandPage,
  removedIds,
  sentTo,
  waitForCreate,
  type BrandFake,
} from './brief-brand-fixture'

const imports = (fake: BrandFake) => sentTo(fake, 'asset.import') as { paths: string[] }[]
const created = async (fake: BrandFake) => {
  await waitForCreate()
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
  await waitFor(() => expect(sentTo(fake, 'campaign.create')).toHaveLength(1))
  return sentTo(fake, 'campaign.create')[0] as CampaignCreateInput
}

describe("Load a brief: the brief's brand files [BB-7, A-396]", () => {
  it('imports each brand path once, after the photos, in role order, with copy: true', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    await openBrandForm(fake)
    const calls = imports(fake)
    expect(calls.map((c) => c.paths)).toEqual([
      ['/w/photos/can.png'],
      ['/w/photos/bottle.png'],
      [LOGO],
      [HEADING],
      [BODY],
    ])
    for (const call of calls.slice(2))
      expect(call).toEqual({ projectId: 'P1', paths: call.paths, library: 'asset', copy: true })
  })

  it('imports a path two roles share once and gives both roles its asset', async () => {
    const fake = brandApi({
      brandFiles: {
        files: [
          { role: 'headingFont', path: HEADING, assetId: null },
          { role: 'bodyFont', path: HEADING, assetId: null },
        ],
        notes: [],
      },
    })
    const { form } = await openBrandForm(fake)
    expect(imports(fake).filter((c) => c.paths[0] === HEADING)).toHaveLength(1)
    expect(await within(form).findByText('Headline: Display Sans')).toBeInTheDocument()
    expect(within(form).getByText('Other text: Display Sans')).toBeInTheDocument()
  })

  it('keeps a role named by asset ID with no import, and never removes it', async () => {
    const fake = brandApi({
      brandFiles: { files: [{ role: 'logo', path: null, assetId: 'L9' }], notes: [] },
    })
    const { form } = await openBrandForm(fake)
    expect(imports(fake)).toHaveLength(2)
    expect(within(form).getByRole('button', { name: 'Remove logo' })).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Remove logo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(removedIds(fake).sort()).toEqual(['B1', 'B2']))
  })

  it('gives a refused import its note and leaves that role empty', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    fake.refuseImport(LOGO, 'The assets folder is missing.')
    const { form } = await openBrandForm(fake)
    const list = within(form).getByRole('list', { name: 'Notes on the brand' })
    expect(list).toHaveTextContent(
      "The brief's logo could not be added: The assets folder is missing.",
    )
    expect(within(form).getByText('No logo.')).toBeInTheDocument()
  })

  it('shows "Adding the brief\'s brand files…" while the brand imports run', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES, subjects: 1 })
    await openBrandPage(fake)
    fake.onCommand('brief.parse', () => ({
      ok: true,
      data: { draft: { campaignName: 'A' }, primaryLanguage: 'en', brandFiles: ALL_FILES },
    }))
    const release = fake.hold()
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Adding the brief's brand files…")
    await act(async () => release())
    await screen.findByRole('region', { name: 'New campaign' })
  })
})

describe('removing the brand assets the form added [BB-7, A-396]', () => {
  it('Cancel removes every added brand asset and the added photos', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    fake.reuse('FB')
    await openBrandForm(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(removedIds(fake).sort()).toEqual(['B1', 'B2', 'FH', 'L1']))
  })

  it('the page going away with the form open removes the added brand assets', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    const { view } = await openBrandForm(fake)
    view.unmount()
    await waitFor(() => expect(removedIds(fake).sort()).toEqual(['B1', 'B2', 'FB', 'FH', 'L1']))
  })

  it('the page going away while the brand imports run removes what was added and stops', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES, subjects: 1 })
    fake.onCommand('brief.parse', () => ({
      ok: true,
      data: { draft: { campaignName: 'A' }, primaryLanguage: 'en', brandFiles: ALL_FILES },
    }))
    const view = await openBrandPage(fake)
    const release = fake.hold()
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await screen.findByRole('status')
    view.unmount()
    await act(async () => release())
    await waitFor(() => expect(removedIds(fake)).toEqual(['L1']))
    expect(imports(fake).map((c) => c.paths)).toEqual([[LOGO]])
  })

  it('removes nothing once the campaign is made', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    const { view } = await openBrandForm(fake)
    await created(fake)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'New campaign' })).toBeNull())
    view.unmount()
    expect(removedIds(fake)).toEqual([])
  })
})

describe('"Ad sets" and what Create sends [BB-7]', () => {
  it('is hidden with one subject row', async () => {
    const { form } = await openBrandForm(brandApi({ subjects: 1 }))
    expect(within(form).queryByRole('group', { name: 'Ad sets' })).toBeNull()
  })

  it('shows with two rows, "Together" pressed, under "Place first photo", with its hint', async () => {
    const { form } = await openBrandForm(brandApi())
    const group = within(form).getByRole('group', { name: 'Ad sets' })
    const together = within(group).getByRole('button', { name: 'One set of ads for all subjects' })
    expect(together).toHaveTextContent('Together')
    expect(together).toHaveAttribute('aria-pressed', 'true')
    const per = within(group).getByRole('button', { name: 'One set of ads per subject' })
    expect(per).toHaveTextContent('Per subject')
    const place = within(form).getByRole('switch', {
      name: 'Start the ad with a subject photo placed',
    })
    expect(place.compareDocumentPosition(group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      within(form).getByText(
        'Per subject makes one direction for each subject, each with its own first ad.',
      ),
    ).toBeInTheDocument()
  })

  it('opens on "Per subject" when the brief says adsPer: subject', async () => {
    const { form } = await openBrandForm(brandApi({ draft: { adsPer: 'subject' } }))
    expect(
      within(form).getByRole('button', { name: 'One set of ads per subject' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends adsPer, the layout, art direction, colours and the brand IDs to campaign.create', async () => {
    const fake = brandApi({
      draft: { layout: 'flat-centre-top', artDirection: ' Calm ', brand: { colours: ['#0b3'] } },
      brandFiles: ALL_FILES,
    })
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'One set of ads per subject' }))
    const input = await created(fake)
    expect(input.brief.adsPer).toBe('subject')
    expect(input.brief.layout).toBe('flat-centre-top')
    expect(input.brief.artDirection).toBe('Calm')
    expect(input.brief.brand).toEqual({ colours: ['#00BB33'] })
    expect(input.brand).toEqual({
      logoAssetId: 'L1',
      headingFontAssetId: 'FH',
      bodyFontAssetId: 'FB',
    })
  })

  it('keeps "Per subject" when a row is removed, and hides the pair', async () => {
    const fake = brandApi()
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'One set of ads per subject' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Remove subject 2' }))
    expect(within(form).queryByRole('group', { name: 'Ad sets' })).toBeNull()
    await userEvent.click(within(form).getByRole('button', { name: 'Add subject' }))
    expect(
      within(form).getByRole('button', { name: 'One set of ads per subject' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
