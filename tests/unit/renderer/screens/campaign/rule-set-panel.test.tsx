// P6-10 (spec/phases/phase-06.md, design addition 8): the "Brand and legal rules" section.
// Palette, required files and per-language word lists; every change sends one ruleSet.update
// with the one list changed, and a refusal's own message shows under that list.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RuleSetPanel } from '@/renderer/screens/campaign/rule-set-panel'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { MASTER, P, campaignGet, sent } from './campaign-fixture'

function asset(id: string, displayName: string, kind: 'image' | 'font' | 'video') {
  return { id, displayName, kind, library: 'asset', missing: false } as AssetList[number]
}

const ASSETS: AssetList = [
  asset('A1', 'logo-mark.png', 'image'),
  asset('A2', 'Sunline Sans', 'font'),
  asset('A3', 'clip.mp4', 'video'),
  asset('A4', 'hero-picnic.png', 'image'),
]

function data(over: Partial<CampaignGet['ruleSet']> = {}): CampaignGet {
  const d = campaignGet([MASTER])
  d.ruleSet = {
    campaignId: 'C1',
    palette: ['#1A2B3C'],
    requiredAssetIds: ['A1'],
    requiredWords: { en: ['Summer Splash'] },
    prohibitedWords: {},
    ...over,
  }
  return d
}

async function panel(d = data(), fake = makeFakeApi()) {
  fake.onQuery('asset.list', () => ({ ok: true, data: ASSETS }))
  await renderApp(<RuleSetPanel projectId={P} campaignId="C1" data={d} />, fake)
  const region = within(screen.getByRole('region', { name: 'Brand and legal rules' }))
  await region.findByText('logo-mark.png')
  return { fake, region }
}

// The one update sent: its input holds the two IDs and exactly one list.
function onlyUpdate(fake: ReturnType<typeof makeFakeApi>) {
  const updates = sent(fake, 'ruleSet.update')
  expect(updates).toHaveLength(1)
  const input = updates[0]?.input as Record<string, unknown>
  expect(Object.keys(input).sort()).toHaveLength(3)
  expect(input).toMatchObject({ projectId: P, campaignId: 'C1' })
  return input
}

describe('RuleSetPanel palette [P6-10]', () => {
  it('adds a colour like #RRGGBB and shows its swatch', async () => {
    const { fake, region } = await panel()
    const palette = within(region.getByRole('group', { name: 'Palette' }))
    await userEvent.type(palette.getByLabelText('Hex colour'), '#F0A500')
    await userEvent.click(palette.getByRole('button', { name: 'Add colour' }))
    expect(onlyUpdate(fake)).toMatchObject({ palette: ['#1A2B3C', '#F0A500'] })
    expect(await palette.findByText('#F0A500')).toBeInTheDocument()
  })

  it.each(['F0A500', '#F0A5', '#GGGGGG', 'orange'])('refuses %s without sending', async (bad) => {
    const { fake, region } = await panel()
    const palette = within(region.getByRole('group', { name: 'Palette' }))
    await userEvent.type(palette.getByLabelText('Hex colour'), bad)
    await userEvent.click(palette.getByRole('button', { name: 'Add colour' }))
    expect(palette.getByText('Use a colour like #1A2B3C.')).toBeInTheDocument()
    expect(sent(fake, 'ruleSet.update')).toHaveLength(0)
  })

  it('removes a colour', async () => {
    const { fake, region } = await panel(data({ palette: ['#1A2B3C', '#F0A500'] }))
    await userEvent.click(region.getByRole('button', { name: 'Remove #1A2B3C' }))
    expect(onlyUpdate(fake)).toMatchObject({ palette: ['#F0A500'] })
    await waitFor(() => expect(region.queryByText('#1A2B3C')).toBeNull())
  })

  it('draws no swatch for an entry that is not an exact #RRGGBB', async () => {
    const { region } = await panel(data({ palette: ['red;background:url(x)', '#1A2B3C'] }))
    const swatches = region.getAllByTestId('swatch')
    expect(swatches).toHaveLength(1)
    expect(swatches[0]?.getAttribute('style')).toContain('rgb(26, 43, 60)')
  })
})

describe('RuleSetPanel required files [P6-10]', () => {
  it('adds the ticked pictures and fonts from the list', async () => {
    const { fake, region } = await panel()
    await userEvent.click(region.getByRole('button', { name: 'Add a required file…' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a required file' }))
    expect(dialog.queryByLabelText(/clip\.mp4/)).toBeNull()
    expect(dialog.queryByLabelText(/logo-mark\.png/)).toBeNull()
    expect(dialog.getByRole('button', { name: 'Add' })).toBeDisabled()
    await userEvent.click(dialog.getByLabelText(/Sunline Sans/))
    await userEvent.click(dialog.getByLabelText(/hero-picnic\.png/))
    await userEvent.click(dialog.getByRole('button', { name: 'Add' }))
    expect(onlyUpdate(fake)).toMatchObject({ requiredAssetIds: ['A1', 'A2', 'A4'] })
    expect(await region.findByText('Sunline Sans')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('removes a required file', async () => {
    const { fake, region } = await panel()
    await userEvent.click(region.getByRole('button', { name: 'Remove logo-mark.png' }))
    expect(onlyUpdate(fake)).toMatchObject({ requiredAssetIds: [] })
    expect(await region.findByText('No required files.')).toBeInTheDocument()
  })
})

describe('RuleSetPanel words [P6-10]', () => {
  it('saves a word list on leaving the field, one entry per line', async () => {
    const d = data({ prohibitedWords: { de: ['billig'] } })
    const { fake, region } = await panel(d)
    const field = region.getByLabelText('Prohibited words (en)')
    await userEvent.type(field, 'cheap{Enter}  {Enter}free gift ')
    expect(sent(fake, 'ruleSet.update')).toHaveLength(0)
    await userEvent.tab()
    expect(onlyUpdate(fake)).toMatchObject({
      prohibitedWords: { de: ['billig'], en: ['cheap', 'free gift'] },
    })
  })

  it('shows a field for each campaign language and sends nothing when unchanged', async () => {
    const { fake, region } = await panel()
    expect(region.getByLabelText('Required words (en)')).toHaveValue('Summer Splash')
    expect(region.getByLabelText('Required words (de)')).toHaveValue('')
    await userEvent.click(region.getByLabelText('Required words (en)'))
    await userEvent.tab()
    expect(sent(fake, 'ruleSet.update')).toHaveLength(0)
  })
})

describe('RuleSetPanel refusals [P6-10]', () => {
  it("shows a refusal's own message under the list that sent it", async () => {
    const fake = makeFakeApi()
    fake.onCommand('ruleSet.update', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'A file in the rule set is not in this project.' },
    }))
    const { region } = await panel(data(), fake)
    await userEvent.click(region.getByRole('button', { name: 'Remove logo-mark.png' }))
    const files = within(region.getByRole('group', { name: 'Required files' }))
    expect(await files.findByRole('alert')).toHaveTextContent(
      'A file in the rule set is not in this project.',
    )
    expect(files.getByText('logo-mark.png')).toBeInTheDocument()
    expect(within(region.getByRole('group', { name: 'Palette' })).queryByRole('alert')).toBeNull()
  })
})

describe('RuleSetPanel accessibility [P6-10]', () => {
  it('has no axe violations when filled', async () => {
    await panel()
    expect(await axeViolations()).toEqual([])
  })

  it('says so when the lists are empty, with no axe violations', async () => {
    const empty = data({ palette: [], requiredAssetIds: [], requiredWords: {} })
    await renderApp(<RuleSetPanel projectId={P} campaignId="C1" data={empty} />)
    expect(screen.getByText('No colours.')).toBeInTheDocument()
    expect(screen.getByText('No required files.')).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('has no axe violations with the dialog open', async () => {
    const { region } = await panel()
    await userEvent.click(region.getByRole('button', { name: 'Add a required file…' }))
    await screen.findByRole('dialog')
    expect(await axeViolations()).toEqual([])
  })
})
