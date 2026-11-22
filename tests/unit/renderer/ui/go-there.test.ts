// P4-14 (spec/screens-ai.md, "The activity panel", Go there): where a job's row leads, and the
// nav store after one action. A gone layer leads to the variant; a gone variant to the
// campaign overview; a video job to its layer, or its variant when it has none (R2E-6); a brief
// reading to the Project tab; a gone campaign nowhere.
import { describe, expect, it } from 'vitest'
import { goTarget, goThere } from '@/renderer/ui/go-there'
import {
  campaignNav,
  createNavStore,
  OVERVIEW_TAB,
  PROJECT_TAB,
  projectNav,
  tabView,
} from '@/renderer/stores/nav-store'
import type { JobPlace } from '@/shared/schemas/queries/activity'
import { jobRow } from '../stores/job-fixture'

const ALL: JobPlace = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }

describe('goTarget [P4-14, FR-217]', () => {
  it.each<[string, Parameters<typeof jobRow>[1], JobPlace, ReturnType<typeof goTarget>]>([
    [
      'a layer',
      { layerId: 'L1' },
      ALL,
      { to: 'layer', campaignId: 'C1', variantId: 'V1', layerId: 'L1' },
    ],
    [
      'a gone layer',
      { layerId: 'L1' },
      { ...ALL, layerName: null },
      { to: 'variant', campaignId: 'C1', variantId: 'V1' },
    ],
    [
      'a slot with no layer',
      { layerId: null },
      ALL,
      { to: 'variant', campaignId: 'C1', variantId: 'V1' },
    ],
    [
      'a gone variant',
      { layerId: 'L1' },
      { ...ALL, variantLabel: null, layerName: null },
      { to: 'campaign', campaignId: 'C1' },
    ],
    [
      'a video job',
      { kind: 'video_generation' },
      ALL,
      { to: 'variant', campaignId: 'C1', variantId: 'V1' },
    ],
    [
      'a video job with a layer',
      { kind: 'video_generation', layerId: 'L1' },
      ALL,
      { to: 'layer', campaignId: 'C1', variantId: 'V1', layerId: 'L1' },
    ],
    [
      'a campaign job',
      { variantId: null },
      { ...ALL, variantLabel: null },
      { to: 'campaign', campaignId: 'C1' },
    ],
    [
      'a brief reading',
      { kind: 'brief_extraction', campaignId: null, variantId: null, slot: null },
      { campaignName: null, variantLabel: null, layerName: null },
      { to: 'project' },
    ],
    [
      'a gone campaign',
      { layerId: 'L1' },
      { campaignName: null, variantLabel: null, layerName: null },
      null,
    ],
  ])('%s', (_name, over, place, target) => {
    expect(goTarget(jobRow('J1', over), place)).toEqual(target)
  })
})

describe('goThere [P4-14]', () => {
  it('opens the campaign and variant tabs and selects the layer, in one action', () => {
    const nav = createNavStore()
    goThere(nav.getState(), 'P1', { to: 'layer', campaignId: 'C1', variantId: 'V1', layerId: 'L1' })
    const s = nav.getState()
    expect(projectNav(s, 'P1')).toEqual({ campaignTabs: ['C1'], shown: 'C1' })
    expect(campaignNav(s, 'P1', 'C1')).toEqual({ variantTabs: ['V1'], shown: 'V1' })
    expect(tabView(s, 'P1', 'V1').selectedLayerId).toBe('L1')
  })

  it('shows the variant without changing its selection', () => {
    const nav = createNavStore()
    nav.getState().setView('P1', 'V1', { selectedLayerId: 'L9' })
    goThere(nav.getState(), 'P1', { to: 'variant', campaignId: 'C1', variantId: 'V1' })
    expect(campaignNav(nav.getState(), 'P1', 'C1').shown).toBe('V1')
    expect(tabView(nav.getState(), 'P1', 'V1').selectedLayerId).toBe('L9')
  })

  it('shows the campaign overview, keeping open variant tabs', () => {
    const nav = createNavStore()
    nav.getState().openCampaign('P1', 'C1')
    nav.getState().openVariant('P1', 'C1', 'V1')
    nav.getState().showCampaign('P1', PROJECT_TAB)
    goThere(nav.getState(), 'P1', { to: 'campaign', campaignId: 'C1' })
    expect(projectNav(nav.getState(), 'P1').shown).toBe('C1')
    expect(campaignNav(nav.getState(), 'P1', 'C1')).toEqual({
      variantTabs: ['V1'],
      shown: OVERVIEW_TAB,
    })
  })

  it('shows the Project tab for a brief reading', () => {
    const nav = createNavStore()
    nav.getState().openCampaign('P1', 'C1')
    goThere(nav.getState(), 'P1', { to: 'project' })
    expect(projectNav(nav.getState(), 'P1')).toEqual({ campaignTabs: ['C1'], shown: PROJECT_TAB })
  })
})
