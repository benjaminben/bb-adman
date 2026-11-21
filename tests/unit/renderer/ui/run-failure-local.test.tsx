// P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68): the run failure, now in
// ui/run-failure/, shows each local reason's sentence with {provider} filled by the label.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RunFailure } from '@/renderer/ui/run-failure'
import { fillMarks, reasonMessage } from '@/shared/providers/messages'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'

const LOCAL: ProviderErrorReason[] = [
  'key_missing',
  'picture_missing',
  'picture_too_large',
  'picture_changed',
  'assets_folder_missing',
  'assets_not_writable',
  'results_not_added',
  'target_gone',
]

describe('RunFailure: local failure sentences [OI-68, FR-069]', () => {
  it.each(LOCAL)('%s shows its sentence with the provider label', async (reason) => {
    const fake = makeFakeApi()
    fake.onQuery('comfy.getInfo', () => ({ ok: true, data: null }))
    const row = jobRow('J1', {
      status: 'failed',
      provider: 'gemini',
      errorKind: 'other',
      errorReason: reason,
    })
    await renderApp(
      <main>
        <RunFailure row={row} projectId="P1" provider={undefined} providerLabel="Google Gemini" />
      </main>,
      fake,
    )
    const sentence = fillMarks(reasonMessage(reason), { provider: 'Google Gemini' })
    expect(screen.getByText(sentence)).toBeInTheDocument()
    expect(sentence).not.toContain('{')
  })
})
