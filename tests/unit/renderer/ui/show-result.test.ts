// R2E-6 (spec/phases/round-2-editor.md D6, "Going there"): showResult follows goTarget, but a
// video job goes to its layer or its variant, and a job with a slot and no layer selects the
// layer that holds the slot (read from variant.get), else shows the variant. It sends no
// job.markSeen.
import { describe, expect, it } from 'vitest'
import { showResult } from '@/renderer/ui/show-result'
import { campaignNav, createNavStore, projectNav, tabView } from '@/renderer/stores/nav-store'
import type { JobPlace } from '@/shared/schemas/queries/activity'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const ALL: JobPlace = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }

function variantWith(layers: Array<{ id: string; slot: string | null }>) {
  return { variant: {}, campaignId: 'C1', layers, clips: [], assets: [] }
}

async function go(over: Parameters<typeof jobRow>[1], layers = variantWith([]), place?: JobPlace) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: layers }))
  const nav = createNavStore()
  nav.getState().setView('P1', 'V1', { selectedLayerId: 'L9' })
  await showResult(fake.api, nav, 'P1', jobRow('J1', over), place)
  const s = nav.getState()
  return {
    fake,
    project: projectNav(s, 'P1').shown,
    variant: campaignNav(s, 'P1', 'C1').shown,
    layer: tabView(s, 'P1', 'V1').selectedLayerId,
  }
}

describe('showResult [R2E-6]', () => {
  it('takes a video job with a layer to the layer', async () => {
    const at = await go({ kind: 'video_generation', layerId: 'L1', slot: null }, undefined, ALL)
    expect(at).toMatchObject({ project: 'C1', variant: 'V1', layer: 'L1' })
  })

  it('takes a video job with no layer to its variant, where the timeline is', async () => {
    const at = await go({ kind: 'video_generation', layerId: null, slot: null }, undefined, ALL)
    expect(at).toMatchObject({ project: 'C1', variant: 'V1', layer: 'L9' })
  })

  it('selects the layer that holds the job slot', async () => {
    const layers = variantWith([
      { id: 'L2', slot: 'headline' },
      { id: 'L3', slot: 'subject-image' },
    ])
    const at = await go({ layerId: null, slot: 'subject-image' }, layers, ALL)
    expect(at).toMatchObject({ project: 'C1', variant: 'V1', layer: 'L3' })
    expect(at.fake.queries).toContainEqual({
      name: 'variant.get',
      input: { projectId: 'P1', variantId: 'V1' },
    })
  })

  it('shows the variant when no layer holds the slot any more', async () => {
    const at = await go({ layerId: null, slot: 'subject-image' }, variantWith([]), ALL)
    expect(at).toMatchObject({ project: 'C1', variant: 'V1', layer: 'L9' })
  })

  it('shows the variant when variant.get is refused', async () => {
    const fake = makeFakeApi()
    fake.onQuery('variant.get', () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }))
    const nav = createNavStore()
    await showResult(fake.api, nav, 'P1', jobRow('J1', { slot: 'subject-image' }), ALL)
    expect(campaignNav(nav.getState(), 'P1', 'C1').shown).toBe('V1')
  })

  it('takes a run row with no place to its layer, the parts taken as there', async () => {
    const at = await go({ layerId: 'L1' })
    expect(at).toMatchObject({ project: 'C1', variant: 'V1', layer: 'L1' })
  })

  it('goes nowhere for a gone campaign, and never marks the job seen', async () => {
    const none: JobPlace = { campaignName: null, variantLabel: null, layerName: null }
    const at = await go({ layerId: 'L1' }, undefined, none)
    expect(at.project).toBe('project')
    expect(at.fake.commands).toEqual([])
  })
})
