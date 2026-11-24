// BB-7 (spec/brief-brand.md, "The brief form", "What it shows"; A-396, A-399): the Section
// "Brand and layout" opens unfolded only when the brief gave it something, sums up what it
// holds, lets the user remove a brand file (asset.remove per removedBrandAssets) or a colour,
// lists the notes, and never draws a path.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ALL_FILES,
  BODY,
  HEADING,
  LOGO,
  brandApi,
  brandSection,
  brandToggle,
  openBrandForm,
  removedIds,
} from './brief-brand-fixture'

const COLOURS = ['#0b3d2e', '#FFF6E5']
const SHARED_FONT = {
  files: [
    { role: 'headingFont' as const, path: HEADING, assetId: null },
    { role: 'bodyFont' as const, path: HEADING, assetId: null },
  ],
  notes: [],
}

describe('the "Brand and layout" Section: folded or open [BB-7]', () => {
  it('is folded, after Sizes and before Rules, when the brief gave no brand', async () => {
    const { form } = await openBrandForm(brandApi())
    expect(brandToggle(form)).toHaveAttribute('aria-expanded', 'false')
    const sizes = within(form).getByRole('region', { name: 'Sizes' })
    const rules = within(form).getByRole('region', { name: 'Rules' })
    const brand = brandSection(form)
    expect(sizes.compareDocumentPosition(brand)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(brand.compareDocumentPosition(rules)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      within(brand).getByText('Photo, text at the bottom left', { selector: ':not(option)' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['a colour', { draft: { brand: { colours: ['#0B3D2E'] } } }],
    ['art direction', { draft: { artDirection: 'Soft morning light' } }],
    ['a layout other than the default', { draft: { layout: 'flat-centre-top' } }],
    ['a note', { draft: { layout: 'nope' } }],
    ['a file', { brandFiles: { files: [ALL_FILES.files[0]!], notes: [] } }],
  ])('opens unfolded when the brief gave %s', async (_, brief) => {
    const { form } = await openBrandForm(brandApi(brief))
    expect(brandToggle(form)).toHaveAttribute('aria-expanded', 'true')
  })

  it('sums up the layout, colours, logo and fonts', async () => {
    const fake = brandApi({
      draft: { layout: 'flat-centre-top', brand: { colours: COLOURS } },
      brandFiles: ALL_FILES,
    })
    const { form } = await openBrandForm(fake)
    expect(
      within(brandSection(form)).getByText(
        'Flat colour, headline above the subject · 2 colours · logo · 2 fonts',
      ),
    ).toBeInTheDocument()
  })

  it('says "1 colour" and "1 font" for one of each', async () => {
    const fake = brandApi({
      draft: { brand: { colours: ['#0B3D2E'] } },
      brandFiles: { files: [ALL_FILES.files[2]!], notes: [] },
    })
    const { form } = await openBrandForm(fake)
    expect(
      within(brandSection(form)).getByText('Photo, text at the bottom left · 1 colour · 1 font'),
    ).toBeInTheDocument()
  })
})

describe('the fields inside [BB-7]', () => {
  it('shows the layout select with the five layouts and the chosen description', async () => {
    const { form } = await openBrandForm(brandApi({ draft: { layout: 'photo-top-centre' } }))
    const select = within(form).getByRole('combobox', { name: 'Starting layout' })
    expect(select).toHaveValue('photo-top-centre')
    expect(within(select).getAllByRole('option')).toHaveLength(5)
    await userEvent.selectOptions(select, 'photo-bottom-left')
    expect(
      within(brandSection(form)).getByText(
        'Text at the bottom left over a photo, with a dark shade from the bottom and an outlined button.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the art direction, trimmed, with its hint', async () => {
    const { form } = await openBrandForm(brandApi({ draft: { artDirection: ' Soft light ' } }))
    expect(within(form).getByRole('textbox', { name: 'Art direction (optional)' })).toHaveValue(
      'Soft light',
    )
    expect(
      within(form).getByText('Added to the first picture prompt of each ad.'),
    ).toBeInTheDocument()
  })

  it('shows "No logo.", "No colours." and the default fonts when the brief gave none', async () => {
    const { form } = await openBrandForm(brandApi())
    const brand = brandSection(form)
    expect(within(brand).getByText('No logo.')).toBeInTheDocument()
    expect(within(brand).getByText('No colours.')).toBeInTheDocument()
    expect(within(brand).getByText('Headline: Default font (Inter)')).toBeInTheDocument()
    expect(within(brand).getByText('Other text: Default font (Inter)')).toBeInTheDocument()
    expect(within(brand).queryByRole('list', { name: 'Notes on the brand' })).toBeNull()
  })

  it('shows the logo by its display name, the colours and the fonts by family or name', async () => {
    const fake = brandApi({ draft: { brand: { colours: COLOURS } }, brandFiles: ALL_FILES })
    const { form } = await openBrandForm(fake)
    const brand = brandSection(form)
    expect(await within(brand).findByText('mark.png')).toBeInTheDocument()
    const chips = within(within(brand).getByRole('list', { name: 'Brand colours' })).getAllByRole(
      'listitem',
    )
    expect(chips.map((li) => li.textContent)).toEqual(['#0B3D2E', '#FFF6E5'])
    expect(await within(brand).findByText('Headline: Display Sans')).toBeInTheDocument()
    expect(await within(brand).findByText('Other text: Text.ttf')).toBeInTheDocument()
  })

  it('lists the notes on the brand', async () => {
    const fake = brandApi({
      draft: { layout: 'nope', brand: { colours: ['teal'] } },
      brandFiles: { files: [], notes: [{ role: 'logo', name: 'gone.png', reason: 'not_found' }] },
    })
    const { form } = await openBrandForm(fake)
    const list = within(form).getByRole('list', { name: 'Notes on the brand' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'The logo "gone.png" was not found.',
      'The colour "teal" is not a hex colour such as #0B3D2E.',
      'The layout "nope" is not one of Adman\'s starting layouts. The default is used.',
    ])
  })

  it('draws no path anywhere on the page', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    const { form } = await openBrandForm(fake)
    await within(form).findByText('mark.png')
    const html = document.body.innerHTML
    for (const text of [LOGO, HEADING, BODY, 'secret-folder', '/w/kit']) {
      expect(html).not.toContain(text)
      expect(html).not.toContain(encodeURIComponent(text))
    }
  })
})

describe('removing a brand file or a colour [BB-7, A-396]', () => {
  it('"Remove logo" removes the added logo asset and shows "No logo."', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'Remove logo' }))
    expect(within(form).getByText('No logo.')).toBeInTheDocument()
    await waitFor(() => expect(removedIds(fake)).toEqual(['L1']))
  })

  it('removes nothing for a logo the project already held', async () => {
    const fake = brandApi({ brandFiles: ALL_FILES })
    fake.reuse('L1')
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'Remove logo' }))
    expect(removedIds(fake)).toEqual([])
  })

  it('removes a font two roles share only when the second role leaves', async () => {
    const fake = brandApi({ brandFiles: SHARED_FONT })
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'Remove headline font' }))
    expect(within(form).getByText('Headline: Default font (Inter)')).toBeInTheDocument()
    expect(removedIds(fake)).toEqual([])
    await userEvent.click(within(form).getByRole('button', { name: 'Remove font for other text' }))
    await waitFor(() => expect(removedIds(fake)).toEqual(['FH']))
  })

  it('"Remove colour {hex}" takes the colour out and removes no asset', async () => {
    const fake = brandApi({ draft: { brand: { colours: COLOURS } } })
    const { form } = await openBrandForm(fake)
    await userEvent.click(within(form).getByRole('button', { name: 'Remove colour #0B3D2E' }))
    const list = within(form).getByRole('list', { name: 'Brand colours' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['#FFF6E5'])
    expect(removedIds(fake)).toEqual([])
    await userEvent.click(within(form).getByRole('button', { name: 'Remove colour #FFF6E5' }))
    expect(within(form).getByText('No colours.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Brand colours' })).toBeNull()
  })
})
