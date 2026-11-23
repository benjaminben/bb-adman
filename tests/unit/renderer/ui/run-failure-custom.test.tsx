// CW-7 (spec/comfyui-custom.md "The check and what is missing"): a custom workflow's
// missing_items row holds only the count, and the sentence sends the person to Check in
// Settings. A shipped row keeps its sentence and list.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RunFailure } from '@/renderer/ui/run-failure'
import { customMissingMessage, fillMarks, reasonMessage } from '@/shared/providers/messages'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'

function draw(result: unknown) {
  const fake = makeFakeApi()
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: null }))
  const row: JobRow = jobRow('J1', {
    status: 'failed',
    provider: 'comfyui',
    errorKind: 'other',
    errorReason: 'missing_items',
    result,
  })
  return renderApp(
    <main>
      <RunFailure row={row} projectId="P1" provider={undefined} providerLabel="ComfyUI" />
    </main>,
    fake,
  )
}

describe('RunFailure: missing_items of a custom workflow [CW-7]', () => {
  it('has the exact sentence of the spec, with "1 thing" for one', () => {
    expect(customMissingMessage(3)).toBe(
      'The server is missing 3 things this workflow needs. Press Check in Settings to see them.',
    )
    expect(customMissingMessage(1)).toBe(
      'The server is missing 1 thing this workflow needs. Press Check in Settings to see them.',
    )
  })

  it('shows the count sentence and no list', async () => {
    await draw({ missing: [], missingCount: 3 })
    expect(screen.getByText(customMissingMessage(3))).toBeVisible()
    expect(screen.queryByRole('list', { name: 'What the server is missing' })).toBeNull()
  })

  it('keeps the shipped sentence and list when the row has names', async () => {
    await draw({ missing: [{ what: 'node', name: 'MossSampler' }] })
    expect(screen.getByText(fillMarks(reasonMessage('missing_items'), { n: 1 }))).toBeVisible()
    expect(screen.getByRole('list', { name: 'What the server is missing' })).toBeVisible()
  })

  it('ignores a count that is not a whole number above 0', async () => {
    await draw({ missing: [], missingCount: 'x' })
    expect(screen.queryByText(/Press Check in Settings/)).toBeNull()
  })
})
