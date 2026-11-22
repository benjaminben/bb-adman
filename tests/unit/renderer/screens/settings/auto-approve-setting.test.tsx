// P10-7 (spec/phases/phase-10-slices.md): the Settings checkbox for deletes without asking,
// under Agent access, saved with settings.update { mcp: { autoApproveDestructive } }.
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoApproveSetting } from '@/renderer/screens/settings/auto-approve-setting'
import { McpSection } from '@/renderer/screens/settings/mcp-section'
import { axeViolations, renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'
import { connect, mcpFake } from './mcp-fixture'

const LABEL = 'Delete without asking'
const LINE = 'Deletes cannot be undone.'

function withAuto(on: boolean) {
  const state = baseState()
  const mcp = { ...state.settings.mcp, autoApproveDestructive: on }
  return makeFakeApi({ ...state, settings: { ...state.settings, mcp } })
}

describe('auto-approve setting [P10-7]', () => {
  it('shows the box, described by its warning line', async () => {
    await renderApp(<AutoApproveSetting />, withAuto(false))
    const box = screen.getByRole('switch', { name: LABEL })
    expect(box).not.toBeChecked()
    expect(box).toHaveAccessibleDescription(LINE)
  })

  it.each([
    [false, true],
    [true, false],
  ])('from %s, saves autoApproveDestructive %s', async (from, to) => {
    const fake = withAuto(from)
    await renderApp(<AutoApproveSetting />, fake)
    const box = screen.getByRole('switch', { name: LABEL })
    expect((box as HTMLInputElement).checked).toBe(from)
    await userEvent.click(box)
    await waitFor(() =>
      expect(fake.commands).toContainEqual({
        name: 'settings.update',
        input: { mcp: { autoApproveDestructive: to } },
      }),
    )
  })

  it('shows a refusal under the box', async () => {
    const fake = withAuto(false)
    fake.onCommand('settings.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'The setting could not be saved.' },
    }))
    await renderApp(<AutoApproveSetting />, fake)
    await userEvent.click(screen.getByRole('switch', { name: LABEL }))
    expect(await screen.findByText('The setting could not be saved.')).toBeInTheDocument()
  })

  it('sits under Agent access in Settings, with no axe violations', async () => {
    const { fake } = mcpFake(connect())
    await renderApp(<McpSection />, fake)
    const section = await screen.findByRole('region', { name: 'Agent access' })
    expect(section).toContainElement(await screen.findByRole('switch', { name: LABEL }))
    expect(await axeViolations()).toEqual([])
  })
})
