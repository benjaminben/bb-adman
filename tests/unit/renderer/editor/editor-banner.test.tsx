// spec/editor.md "Banner" and spec/screens-ai.md "Place text with AI" (P4-16): the layout job's
// line comes first of the banner's lines, with Stop while it runs and Dismiss after a failure.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditorBanner } from '@/renderer/editor/editor-banner'
import { axeViolations } from '../render'

describe('EditorBanner layout line [P4-16]', () => {
  it('the running line comes before a missing file, and Stop calls back', async () => {
    const onStop = vi.fn()
    render(<EditorBanner missingFile overflowCount={2} layout={{ kind: 'running', onStop }} />)
    expect(screen.getByRole('status')).toHaveTextContent(/^Placing text with AI…$/)
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledOnce()
    expect(await axeViolations()).toEqual([])
  })

  it('the failure line shows its words, and Dismiss calls back', async () => {
    const onDismiss = vi.fn()
    const words =
      'Text could not be placed. Fake provider could not finish this request. Try again.'
    render(
      <EditorBanner
        missingFile={false}
        overflowCount={1}
        layout={{ kind: 'failed', words, onDismiss }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(words)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('with no layout line the other lines show as before', async () => {
    render(<EditorBanner missingFile={false} overflowCount={1} layout={null} />)
    expect(screen.getByRole('status')).toHaveTextContent(/^1 text does not fit$/)
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'About fixing it',
    ])
    await userEvent.click(screen.getByRole('button', { name: 'About fixing it' }))
    expect(
      screen.getByText('Make the box larger, the text smaller, or shorten the text.'),
    ).toBeVisible()
  })
})
