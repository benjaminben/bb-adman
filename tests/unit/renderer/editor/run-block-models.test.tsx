// R3-2: an earlier run names the service and model that made its pictures, on the page.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RunBlock } from '@/renderer/editor/earlier-options/run-block'
import { runTitle } from '@/renderer/editor/earlier-options/run-words'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const GEMINI: ProviderInfo = {
  ...baseState().providers[0]!,
  defaultModels: { image: 'gemini-nano-banana-2.1' },
  modelLabels: { image: 'Nano Banana 2.1' },
}
const ROW = jobRow('J1', { status: 'succeeded', model: 'gemini-nano-banana-2.1' })

describe('earlier runs name the model [R3-2]', () => {
  it('shows the service and model beside the run’s time', async () => {
    const fake = makeFakeApi(baseState({ providers: [GEMINI] }))
    await renderApp(
      <ul>
        <RunBlock
          projectId="P1"
          option={{ job: ROW, assets: [] }}
          inUse={null}
          locked={false}
          onUse={() => {}}
        />
      </ul>,
      fake,
    )
    await act(async () => {})
    expect(screen.getByText('Google Gemini · Nano Banana 2.1')).toBeVisible()
  })

  it('names the model in the run’s header', () => {
    expect(runTitle(ROW, [GEMINI])).toMatch(/ · Google Gemini · Nano Banana 2\.1 · Pictures$/)
  })

  it('names a model the app does not know by its ID', () => {
    const row = jobRow('J2', { model: 'gemini-older-model' })
    expect(runTitle(row, [GEMINI])).toMatch(/ · Google Gemini · gemini-older-model · Pictures$/)
  })
})
