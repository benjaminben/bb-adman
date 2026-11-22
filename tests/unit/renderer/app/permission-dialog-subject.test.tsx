// SUBJ-1 (spec/phases/subject-delete.md, D-101): an agent's subject delete is asked in the
// same dialog as the other deletes. Its consequence line is the last line of the body and the
// dialog's description; nothing else in the dialog changes.
import { describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']

const TARGET = 'Subject "Tea tin" (2 photos) in "Spring Work"'
const COST = 'This cannot be undone. Its photos stay in the project without a subject.'

const ask: Ask = {
  requestId: 'made-up-request-1',
  agentClient: null,
  action: 'delete subjects',
  target: TARGET,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  kind: 'delete',
  fileCount: 0,
}

describe('permission dialog for a subject delete [SUBJ-1]', () => {
  it('ends with the subject cost line, which is the description', async () => {
    const fake = makeFakeApi()
    await renderApp(<PermissionDialog />, fake)
    act(() => fake.emit('agent.permissionRequested', ask))
    const dialog = await screen.findByRole('dialog', { name: 'An agent asks to delete' })
    expect(dialog).toHaveTextContent(`An agent wants to delete subjects: ${TARGET}.`)
    expect(dialog).toHaveAccessibleDescription(COST)
    const lines = within(dialog).getAllByText(/./, { selector: 'p' })
    expect(lines.at(-1)).toHaveTextContent(COST)
    expect(within(dialog).getByRole('checkbox', { name: "Don't ask again for deletes" })).toBe(
      within(dialog).getByRole('checkbox'),
    )
    expect(screen.getByRole('button', { name: 'Refuse' })).toHaveFocus()
    expect(await axeViolations()).toEqual([])
  })
})
