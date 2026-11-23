// D-105 (spec/mcp-and-agents.md, "Directions"): an agent's direction delete is asked in the
// same dialog as the other deletes. Its consequence line is the last line of the body and the
// dialog's description; nothing else in the dialog changes.
import { describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import type { EventMap } from '@/shared/schemas/events'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']

const TARGET = 'Direction "Bold" (4 variants) in campaign "Summer Splash!" in "Spring Work"'
const COST =
  'This cannot be undone. Every variant of this direction is deleted too, and the undo list ' +
  'of this campaign is cleared.'

const ask: Ask = {
  requestId: 'made-up-request-1',
  agentClient: null,
  action: 'delete directions',
  target: TARGET,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  kind: 'delete',
  fileCount: 0,
}

describe('permission dialog for a direction delete [D-105]', () => {
  it('ends with the direction cost line, which is the description', async () => {
    const fake = makeFakeApi()
    await renderApp(<PermissionDialog />, fake)
    act(() => fake.emit('agent.permissionRequested', ask))
    const dialog = await screen.findByRole('dialog', { name: 'An agent asks to delete' })
    expect(dialog).toHaveTextContent(`An agent wants to delete directions: ${TARGET}.`)
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
