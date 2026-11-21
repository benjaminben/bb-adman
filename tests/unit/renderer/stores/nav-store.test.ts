// spec/editor.md, "What each tab keeps" [FR-211 to FR-214, FR-242, OI-31]: one store for the
// window holding, per project, the campaign tabs; per campaign, the variant tabs; per variant
// tab, the selected layer and the zoom.
import { describe, expect, it } from 'vitest'
import { createNavStore, projectNav, campaignNav, tabView } from '@/renderer/stores/nav-store'

function setUp() {
  const store = createNavStore()
  return { store, nav: store.getState() }
}

describe('nav store: campaign tabs [FR-211]', () => {
  it('starts on the Project tab with no campaign tabs', () => {
    const { store } = setUp()
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: [], shown: 'project' })
  })

  it('opens a campaign tab and shows it; opening it again only shows it', () => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openCampaign('P1', 'C2')
    nav.openCampaign('P1', 'C1')
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: ['C1', 'C2'], shown: 'C1' })
  })

  it('keeps each project to itself', () => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openCampaign('P2', 'C9')
    nav.showCampaign('P2', 'project')
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: ['C1'], shown: 'C1' })
    expect(projectNav(store.getState(), 'P2')).toEqual({ campaignTabs: ['C9'], shown: 'project' })
  })

  it.each([
    ['the shown tab, which shows the tab before it', 'C2', ['C1', 'C3'], 'C1'],
    ['the first shown tab, which shows Project', 'C1', ['C2', 'C3'], 'project'],
  ])('closes %s', (_, closed, tabs, shown) => {
    const { store, nav } = setUp()
    for (const id of ['C1', 'C2', 'C3']) nav.openCampaign('P1', id)
    nav.showCampaign('P1', closed)
    nav.closeCampaign('P1', closed)
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: tabs, shown })
  })

  it('closes a tab that is not shown and keeps the shown one', () => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openCampaign('P1', 'C2')
    nav.closeCampaign('P1', 'C1')
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: ['C2'], shown: 'C2' })
  })

  it('drops the tab of a campaign that is gone, with its variant tabs', () => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openVariant('P1', 'C1', 'V1')
    nav.keepCampaigns('P1', ['C2'])
    expect(projectNav(store.getState(), 'P1')).toEqual({ campaignTabs: [], shown: 'project' })
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({
      variantTabs: [],
      shown: 'overview',
    })
  })

  it('drops everything of a project that closes [OI-31]', () => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openVariant('P1', 'C1', 'V1')
    nav.openCampaign('P2', 'C9')
    nav.keepProjects(['P2'])
    expect(store.getState().projects.P1).toBeUndefined()
    expect(projectNav(store.getState(), 'P2').campaignTabs).toEqual(['C9'])
  })
})

describe('nav store: variant tabs [FR-212, FR-214]', () => {
  it('starts on the Overview tab', () => {
    const { store } = setUp()
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({
      variantTabs: [],
      shown: 'overview',
    })
  })

  it.each([
    ['shows it', false, 'V2'],
    ['behind keeps the shown tab', true, 'overview'],
  ])('opens a variant tab: %s', (_, behind, shown) => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1', true)
    nav.openVariant('P1', 'C1', 'V2', behind)
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({ variantTabs: ['V1', 'V2'], shown })
  })

  it('opening an open variant again does not add a second tab', () => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1')
    nav.showVariant('P1', 'C1', 'overview')
    nav.openVariant('P1', 'C1', 'V1')
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({ variantTabs: ['V1'], shown: 'V1' })
  })

  it('closes a variant tab, shows the one before it, and forgets its view', () => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1')
    nav.openVariant('P1', 'C1', 'V2')
    nav.setView('P1', 'V2', { zoom: 200 })
    nav.closeVariant('P1', 'C1', 'V2')
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({ variantTabs: ['V1'], shown: 'V1' })
    expect(tabView(store.getState(), 'P1', 'V2')).toEqual({ selectedLayerId: null, zoom: 'fit' })
  })

  it('drops the tab of a variant that is gone and shows Overview if it was shown', () => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1')
    nav.openVariant('P1', 'C1', 'V2')
    nav.keepVariants('P1', 'C1', ['V1'])
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({ variantTabs: ['V1'], shown: 'V1' })
    nav.keepVariants('P1', 'C1', [])
    expect(campaignNav(store.getState(), 'P1', 'C1')).toEqual({
      variantTabs: [],
      shown: 'overview',
    })
  })

  it('leaves the state alone when every variant is still there', () => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1')
    const before = store.getState().projects
    nav.keepVariants('P1', 'C1', ['V1', 'V2'])
    expect(store.getState().projects).toBe(before)
  })
})

describe('nav store: what each variant tab keeps [FR-213]', () => {
  it('keeps the selected layer and the zoom per tab', () => {
    const { store, nav } = setUp()
    nav.setView('P1', 'V1', { selectedLayerId: 'L2' })
    nav.setView('P1', 'V1', { zoom: 150 })
    nav.setView('P1', 'V2', { zoom: 50 })
    expect(tabView(store.getState(), 'P1', 'V1')).toEqual({ selectedLayerId: 'L2', zoom: 150 })
    expect(tabView(store.getState(), 'P1', 'V2')).toEqual({ selectedLayerId: null, zoom: 50 })
  })

  it('does not change the state for a view that is already so', () => {
    const { store, nav } = setUp()
    nav.setView('P1', 'V1', { zoom: 150 })
    const before = store.getState().projects
    nav.setView('P1', 'V1', { zoom: 150, selectedLayerId: null })
    expect(store.getState().projects).toBe(before)
  })
})

describe('nav store: stepping through tabs [FR-242]', () => {
  it.each([
    ['next from Project', 'project', 1, 'C1'],
    ['next from the last wraps to Project', 'C2', 1, 'project'],
    ['previous from Project wraps to the last', 'project', -1, 'C2'],
    ['previous from the first', 'C1', -1, 'project'],
  ] as const)('campaign tabs: %s', (_, from, step, to) => {
    const { store, nav } = setUp()
    nav.openCampaign('P1', 'C1')
    nav.openCampaign('P1', 'C2')
    nav.showCampaign('P1', from)
    nav.stepCampaign('P1', step)
    expect(projectNav(store.getState(), 'P1').shown).toBe(to)
  })

  it.each([
    ['next from Overview', 'overview', 1, 'V1'],
    ['next from the last wraps to Overview', 'V2', 1, 'overview'],
    ['previous from Overview wraps to the last', 'overview', -1, 'V2'],
  ] as const)('variant tabs: %s', (_, from, step, to) => {
    const { store, nav } = setUp()
    nav.openVariant('P1', 'C1', 'V1')
    nav.openVariant('P1', 'C1', 'V2')
    nav.showVariant('P1', 'C1', from)
    nav.stepVariant('P1', 'C1', step)
    expect(campaignNav(store.getState(), 'P1', 'C1').shown).toBe(to)
  })
})
