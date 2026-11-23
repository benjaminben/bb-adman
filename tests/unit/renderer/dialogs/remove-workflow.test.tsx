// CW-4 (spec/comfyui-custom.md "Screens", D-104): "Remove {name}?", built like delete-subject.
// "Keep" has focus; nothing is sent on open, Escape or "Keep"; "Remove workflow" sends one
// comfyWorkflow.remove, even on a double click. A refusal stays in the dialog. No undo.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { RemoveWorkflow } from '@/renderer/dialogs/remove-workflow'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { TIDE_CLIP } from '../screens/settings/custom-workflow-fixture'

const BODY =
  'This removes the workflow from this computer and cannot be undone. Runs that have not started yet will fail.'
const GONE = 'That workflow is not on this computer.'

function Opener(props: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <h1>Settings</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <RemoveWorkflow
        workflow={open ? TIDE_CLIP : null}
        onClose={() => {
          setOpen(false)
          props.onClose()
        }}
      />
    </main>
  )
}

async function draw(fake = makeFakeApi()) {
  let closed = 0
  const view = await renderApp(<Opener onClose={() => (closed += 1)} />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  const dialog = await screen.findByRole('dialog', { name: 'Remove Tide clip?' })
  const sent = () => fake.commands.filter((c) => c.name === 'comfyWorkflow.remove')
  return { ...view, fake, dialog, sent, closed: () => closed }
}

describe('Remove workflow [CW-4, D-104]', () => {
  it('says what removing does, as the visible description', async () => {
    const { dialog } = await draw()
    expect(dialog).toHaveAccessibleDescription(BODY)
    expect(within(dialog).getByText(BODY)).toBeVisible()
  })

  it('focuses "Keep", offers "Remove workflow", and sends nothing on open', async () => {
    const { dialog, sent } = await draw()
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Remove workflow' })).toBeInTheDocument()
    expect(sent()).toEqual([])
    expect(dialog.textContent ?? '').not.toMatch(/undo(?!ne)/i)
  })

  it.each([
    ['"Keep"', () => userEvent.click(screen.getByRole('button', { name: 'Keep' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('%s closes and sends nothing', async (_what, act) => {
    const { sent, closed } = await draw()
    await act()
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toEqual([])
  })

  it('sends comfyWorkflow.remove once on a double click, both buttons disabled meanwhile', async () => {
    const fake = makeFakeApi()
    let finish: (r: Result<unknown>) => void = () => {}
    fake.onCommand('comfyWorkflow.remove', () => new Promise((resolve) => (finish = resolve)))
    const { dialog, sent, closed } = await draw(fake)
    const remove = within(dialog).getByRole('button', { name: 'Remove workflow' })
    await userEvent.dblClick(remove)
    expect(sent()).toEqual([
      { name: 'comfyWorkflow.remove', input: { workflowId: 'custom-1a2b3c4d5e6f' } },
    ])
    expect(remove).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toBeDisabled()
    finish({ ok: true, data: { workflowId: 'custom-1a2b3c4d5e6f' } })
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toHaveLength(1)
  })

  it('shows a refusal inside, and stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('comfyWorkflow.remove', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: GONE },
    }))
    const { dialog, closed } = await draw(fake)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove workflow' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(GONE)
    expect(closed()).toBe(0)
    expect(within(dialog).getByRole('button', { name: 'Remove workflow' })).toBeEnabled()
  })

  it('has no accessibility violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})
