// HOME-1 (spec/phases/design-wave-screens-b.md, "HOME-1 — Project home"): the page is the
// title and two Sections. The project file path is the title's tooltip and description only;
// campaigns are tiles with a dashed "+" tile; missing files are a mark that opens the relink
// dialog; Close and Package live in the project menu.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { axeViolations, renderApp } from '../../render'
import { asset, serveAssets } from '../../dialogs/relink-fixture'
import { PROJECT, campaign, projectApi, projectGet } from './project-fixture'

const summer = { ...campaign('summer-k3f9q2', 'Summer'), cover: { variantId: 'V1', rev: 1 } }
const twoCampaigns = projectGet([summer, campaign('fall-a2b3c4', 'Fall')])

async function draw(reply = twoCampaigns) {
  const fake = projectApi(reply)
  fake.onQuery('thumbnail.get', () => ({ ok: true, data: { state: 'none' } }))
  await renderApp(<ProjectHome project={PROJECT} />, fake)
  await screen.findByRole('heading', { name: 'Campaigns', level: 2 })
  return fake
}

describe('project home sections [HOME-1]', () => {
  it('shows two level 2 headings, Campaigns and Assets, with no card around them', async () => {
    await draw()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Campaigns', 'Assets'])
    for (const heading of headings) expect(heading.closest('[class*="card"]')).toBeNull()
    expect(screen.getByRole('region', { name: 'Campaigns' })).toBeInTheDocument()
  })

  it('does not print the file path; it is the title tooltip and description', async () => {
    await draw()
    const title = screen.getByRole('heading', { name: 'Summer', level: 1 })
    expect(title).toHaveAttribute('title', '/w/Summer.adman')
    expect(title).toHaveAccessibleDescription('/w/Summer.adman')
    const description = document.getElementById(title.getAttribute('aria-describedby') ?? '')
    expect(screen.queryAllByText('/w/Summer.adman')).toEqual([description])
    expect(description?.className).toMatch(/hidden/)
    expect(document.body.innerHTML.match(/\/w\/Summer\.adman/g)).toHaveLength(2)
  })

  it('has no Close project and no Package project button', async () => {
    await draw()
    expect(screen.queryByRole('button', { name: /Close project|Close Summer/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Package project…' })).toBeNull()
    expect(screen.queryByText('Close project')).toBeNull()
  })

  it('draws each campaign as one button named "Open {name}" holding its cover', async () => {
    await draw()
    const list = screen.getByRole('list', { name: 'Campaigns' })
    const tile = within(list).getByRole('button', { name: 'Open Summer' })
    expect(tile.querySelector('img, [role="img"], [class*="cover"]')).not.toBeNull()
    expect(within(list).getByRole('button', { name: 'Open Fall' })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'Open' })).toBeNull()
    expect(within(tile).getByTitle('0 variants')).toBeInTheDocument()
  })

  it('ends the list with a "+" tile that asks for a new campaign', async () => {
    await draw()
    const list = screen.getByRole('list', { name: 'Campaigns' })
    const plus = within(list).getByRole('button', { name: 'New campaign' })
    expect(plus).toHaveAttribute('title', 'New campaign')
    await userEvent.click(plus)
    expect(await screen.findByRole('region', { name: 'Brief' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Campaigns' })).toBeNull()
  })

  it('says "No campaigns yet" with no campaign, and keeps the brief buttons', async () => {
    await draw(projectGet())
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument()
    const campaigns = screen.getByRole('region', { name: 'Campaigns' })
    expect(within(campaigns).getByRole('button', { name: 'Load a brief' })).toBeInTheDocument()
    expect(within(campaigns).getByRole('button', { name: 'Paste a brief' })).toBeInTheDocument()
  })

  it('shows missing files as a mark whose click opens "Find missing files"', async () => {
    const fake = projectApi({ ...twoCampaigns, missingAssetCount: 3 })
    serveAssets(fake, [asset('a1', 'hero-shot.png')])
    await renderApp(<ProjectHome project={PROJECT} />, fake)
    const mark = await screen.findByRole('button', { name: /^3 missing/ })
    expect(mark).toHaveTextContent('3 missing')
    await userEvent.click(mark)
    expect(screen.getByRole('dialog', { name: 'Find missing files' })).toBeInTheDocument()
  })

  it('reaches Import files…, Import a folder… and Open assets by Tab in that order', async () => {
    await draw()
    const files = screen.getByRole('button', { name: 'Import files…' })
    expect(files).toHaveTextContent('Import')
    expect(files).toHaveAttribute('title', 'Import files…')
    files.focus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Import a folder…' })).toHaveFocus()
    await userEvent.tab()
    const open = screen.getByRole('button', { name: 'Open assets' })
    expect(open).toHaveFocus()
    expect(open).toHaveAttribute('title', 'Open assets')
  })

  it('keeps the Assets help in an InfoTip', async () => {
    await draw()
    expect(screen.getByRole('button', { name: 'About Assets' })).toBeInTheDocument()
  })

  it.each([
    ['with campaigns', twoCampaigns],
    ['without campaigns', projectGet()],
  ])('has no axe violations %s', async (_, reply) => {
    await draw(reply)
    await waitFor(() => expect(screen.queryByText('Loading the project…')).toBeNull())
    expect(await axeViolations()).toEqual([])
  })
})
