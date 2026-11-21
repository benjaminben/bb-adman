// P4-20, Phase 4 exit criterion 3 [REQ: FR-069, FR-152; workflow 5.8 "The run fails"]: each of
// the six error kinds shows its own sentence and a Retry button, both in a layer's earlier options
// and in an activity row, and Retry for a paid run opens the run dialog. The end-to-end run
// (tests/e2e/workflow-5-1-failures.ts) reaches five kinds through a stand-in for Gemini; "timeout"
// needs the adapter's two-minute timer, so it is reached here only.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityRow } from '@/renderer/app/activity-row'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { plainMessage } from '@/shared/providers/messages'
import type { ProviderErrorKind } from '@/shared/schemas/queries/app'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import { LOGO, P } from './editor-fixture'

const KINDS: ProviderErrorKind[] = ['bad_key', 'quota', 'refused', 'timeout', 'offline', 'other']
const LAYER: LayerRow = { ...LOGO, source: { assetId: 'A2' } }
const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }

const failed = (errorKind: ProviderErrorKind) =>
  jobRow('J1', { status: 'failed', errorKind, layerId: LAYER.id, slot: null })

describe('Each error kind in the earlier options [P4-20, FR-069]', () => {
  it.each(KINDS)('a failed %s run shows its sentence and Retry', async (kind) => {
    const fake = campaignApi()
    fake.onQuery('job.earlierOptions', () => ({
      ok: true,
      data: [{ job: failed(kind), assets: [] }],
    }))
    await renderApp(
      <main>
        <EarlierOptions projectId={P} layer={LAYER} />
      </main>,
      fake,
    )
    const region = screen.getByRole('region', { name: 'Earlier options' })
    expect(await within(region).findByText(plainMessage(kind, 'Google Gemini'))).toBeVisible()
    expect(within(region).getByText('Failed')).toBeVisible()
    await userEvent.click(within(region).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('dialog', { name: 'Retry the run' })).toBeVisible()
  })
})

describe('Each error kind in the activity panel [P4-20, FR-069, FR-152]', () => {
  it.each(KINDS)('a failed %s row shows its sentence and Retry', async (kind) => {
    await renderApp(
      <main>
        <ul aria-label="Jobs">
          <ActivityRow entry={{ job: failed(kind), place: PLACE }} projectId="P1" onGo={vi.fn()} />
        </ul>
      </main>,
      makeFakeApi(baseState()),
    )
    const row = screen.getByRole('listitem')
    expect(within(row).getByText(plainMessage(kind, 'Google Gemini'))).toBeVisible()
    expect(within(row).getByText('Failed')).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('dialog', { name: 'Retry' })).toBeVisible()
  })

  it('gives each kind a sentence of its own', () => {
    const sentences = new Set(KINDS.map((kind) => plainMessage(kind, 'Google Gemini')))
    expect(sentences.size).toBe(KINDS.length)
  })
})
