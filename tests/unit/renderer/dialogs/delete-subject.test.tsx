// SUBJ-1 (spec/phases/subject-delete.md, D-101): "Delete {name}?" with "This cannot be undone."
// and, when the subject has photos, what happens to them. "Keep" has focus; nothing is sent
// before the click on "Delete subject", which sends subject.delete once. A refusal stays in
// the dialog. No undo and no "undo" wording (D-099).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { DeleteSubject } from '@/renderer/dialogs/delete-subject'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'

const BLEND: SubjectRow = {
  id: 's-blend',
  name: 'Harbour Blend',
  description: 'A dark roast in a blue tin.',
  createdAt: '2026-11-20T00:00:00.000Z',
}
const IN_USE = 'This subject is used by a campaign. Remove it from every campaign first.'

// Opened by a click after the page draws, as the subject card opens it.
function Opener(props: { photoCount: number; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <h1>Tidewater Coffee</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <DeleteSubject
        projectId="P1"
        subject={open ? BLEND : null}
        photoCount={props.photoCount}
        onClose={() => {
          setOpen(false)
          props.onClose()
        }}
      />
    </main>
  )
}

async function draw(photoCount = 0, fake = makeFakeApi()) {
  let closed = 0
  const view = await renderApp(
    <Opener photoCount={photoCount} onClose={() => (closed += 1)} />,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  const dialog = await screen.findByRole('dialog', { name: 'Delete Harbour Blend?' })
  const sent = () => fake.commands.filter((c) => c.name === 'subject.delete')
  return { ...view, fake, dialog, sent, closed: () => closed }
}

describe('Delete subject [SUBJ-1, D-101]', () => {
  it.each([
    [0, 'This cannot be undone.'],
    [1, 'This cannot be undone. Its photo stays in the project without a subject.'],
    [3, 'This cannot be undone. Its 3 photos stay in the project without a subject.'],
  ])('with %i photos says "%s", as the description', async (count, words) => {
    const { dialog } = await draw(count)
    expect(dialog).toHaveAccessibleDescription(words)
    expect(within(dialog).getByText(words).tagName).toBe('P')
  })

  it('focuses "Keep", then "Delete subject" as the danger action, and sends nothing on open', async () => {
    const { dialog, sent } = await draw(2)
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Delete subject' })).toBeInTheDocument()
    expect(sent()).toEqual([])
    expect(dialog.textContent ?? '').not.toMatch(/undo(?!ne)/i)
  })

  it.each([
    ['"Keep"', () => userEvent.click(screen.getByRole('button', { name: 'Keep' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('%s closes and sends nothing', async (_what, act) => {
    const { sent, closed } = await draw(1)
    await act()
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toEqual([])
  })

  it('sends subject.delete once on a double click, with both buttons disabled while it runs', async () => {
    const fake = makeFakeApi()
    let finish: (r: Result<unknown>) => void = () => {}
    fake.onCommand('subject.delete', () => new Promise((resolve) => (finish = resolve)))
    const { dialog, sent, closed } = await draw(1, fake)
    const remove = within(dialog).getByRole('button', { name: 'Delete subject' })
    await userEvent.dblClick(remove)
    expect(sent()).toEqual([
      { name: 'subject.delete', input: { projectId: 'P1', subjectId: 's-blend' } },
    ])
    expect(remove).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toBeDisabled()
    finish({ ok: true, data: { subjectId: 's-blend' } })
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toHaveLength(1)
  })

  it('shows a refusal as an alert at the top, and stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('subject.delete', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: IN_USE },
    }))
    const { dialog, closed } = await draw(0, fake)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete subject' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(IN_USE)
    expect(screen.getByRole('dialog', { name: 'Delete Harbour Blend?' })).toBe(dialog)
    expect(closed()).toBe(0)
    expect(within(dialog).getByRole('button', { name: 'Delete subject' })).toBeEnabled()
  })

  it('has no accessibility violations', async () => {
    await draw(2)
    expect(await axeViolations()).toEqual([])
  })
})
