// The cost line of a retry never guesses (a review note on DLG-4a): a stored request whose
// count cannot be read names no number, and a run with no stored provider is named as an
// unknown provider and still counts as paid.
import { act, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import { renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

async function openRetry(over: Partial<RunDialogProps>) {
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'image',
    title: 'Retry the run',
    confirmLabel: 'Retry',
    onConfirm: vi.fn(async () => ({ ok: true as const, data: null })),
    onCancel: vi.fn(),
    ...over,
  }
  await renderApp(<RunDialog {...props} />, makeFakeApi())
  const element = await screen.findByRole('dialog', { name: 'Retry the run' })
  await act(async () => {})
  return element
}

describe('the cost line of a retry [DLG-4a]', () => {
  it('names no number of pictures when a retry gives no count', async () => {
    const element = await openRetry({ retry: { provider: 'gemini' } })
    expect(element).toHaveAccessibleDescription('Paid: pictures to Google Gemini')
  })

  it('names a retried run with no stored provider as an unknown provider, still paid', async () => {
    const element = await openRetry({
      retry: { provider: '' },
      count: { label: 'Pictures', value: 2, min: 1, max: 8 },
    })
    expect(element).toHaveAccessibleDescription('Paid: 2 pictures to an unknown provider')
  })
})
