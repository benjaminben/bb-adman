// spec/agent-runs.md "Settings block": one tick per offered provider, the limit, each
// command's refusal, and the block shown whether or not the MCP server is on.
import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { baseState } from '../../fake-api'
import { refused } from './mcp-fixture'
import { COMFY, LIMIT, PAID, agentRunsFake, provider, tickName } from './agent-runs-fixture'

async function section() {
  return within(await screen.findByRole('region', { name: 'Agent runs' }))
}

const sent = (fake: ReturnType<typeof agentRunsFake>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

describe('settings: agent runs [spec/agent-runs.md, Settings block]', () => {
  it.each([
    ['a local provider that makes pictures and video', true, COMFY],
    ['a local provider that makes pictures only', true, provider({ id: 'pics', jobs: ['image'] })],
    ['a provider that is not available', false, provider({ id: 'off', available: false })],
    ['a provider that makes no picture or video', false, provider({ id: 'words', jobs: ['text'] })],
    ['a paid provider, not yet offered', false, provider({ id: 'paid', local: false })],
  ])('offers a tick for %s: %s', async (_, shown, row) => {
    await renderApp(<SettingsScreen />, agentRunsFake([row]))
    const box = await section()
    expect(box.queryByRole('checkbox', { name: tickName(row.label) }) !== null).toBe(shown)
  })

  it('shows no tick for the providers of the base state, and no paid line', async () => {
    await renderApp(<SettingsScreen />)
    const box = await section()
    expect(box.queryAllByRole('checkbox')).toEqual([])
    expect(box.queryByText(PAID)).toBeNull()
  })

  it('ticks and unticks with agentRuns.setAllowed, showing the saved state', async () => {
    const fake = agentRunsFake([COMFY])
    await renderApp(<SettingsScreen />, fake)
    const tick = (await section()).getByRole('checkbox', { name: tickName('ComfyUI') })
    expect(tick).not.toBeChecked()
    await userEvent.click(tick)
    await waitFor(() => expect(tick).toBeChecked())
    await userEvent.click(tick)
    await waitFor(() => expect(tick).not.toBeChecked())
    expect(sent(fake, 'agentRuns.setAllowed')).toEqual([
      { provider: 'comfyui', allowed: true },
      { provider: 'comfyui', allowed: false },
    ])
  })

  it('shows a saved tick as ticked', async () => {
    await renderApp(
      <SettingsScreen />,
      agentRunsFake([COMFY], { agentRuns: { comfyui: { allowed: true } } }),
    )
    expect((await section()).getByRole('checkbox', { name: tickName('ComfyUI') })).toBeChecked()
  })

  it("shows a refused tick's message under it, and leaves it unticked", async () => {
    const fake = agentRunsFake([COMFY])
    fake.onCommand('agentRuns.setAllowed', () =>
      refused('Agents cannot start runs with ComfyUI.', 'agent_runs_not_offered'),
    )
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const tick = box.getByRole('checkbox', { name: tickName('ComfyUI') })
    await userEvent.click(tick)
    expect(await box.findByText('Agents cannot start runs with ComfyUI.')).toBeInTheDocument()
    expect(tick).toHaveAccessibleDescription('Agents cannot start runs with ComfyUI.')
    expect(tick).not.toBeChecked()
  })

  it('shows the limit, 1 to 16, and saves a change with agentRuns.setLimit', async () => {
    const fake = agentRunsFake([COMFY], { agentRunLimit: 6 })
    await renderApp(<SettingsScreen />, fake)
    const field = (await section()).getByLabelText(LIMIT)
    expect(field).toHaveValue(6)
    expect(field).toHaveAttribute('min', '1')
    expect(field).toHaveAttribute('max', '16')
    fireEvent.change(field, { target: { value: '12' } })
    await waitFor(() => expect(sent(fake, 'agentRuns.setLimit')).toEqual([{ limit: 12 }]))
    expect(field).toHaveValue(12)
  })

  it("sends nothing for an empty limit field, and shows a refused limit's message", async () => {
    const fake = agentRunsFake([COMFY])
    fake.onCommand('agentRuns.setLimit', () => refused('Choose a limit from 1 to 16.'))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const field = box.getByLabelText(LIMIT)
    fireEvent.change(field, { target: { value: '' } })
    expect(sent(fake, 'agentRuns.setLimit')).toEqual([])
    fireEvent.change(field, { target: { value: '99' } })
    expect(await box.findByText('Choose a limit from 1 to 16.')).toBeInTheDocument()
    expect(field).toHaveAccessibleDescription('Choose a limit from 1 to 16.')
  })

  it.each([true, false])(
    'shows the block below Agent access when the MCP server is on: %s',
    async (on) => {
      const base = baseState().settings
      const fake = agentRunsFake([COMFY], { mcp: { ...base.mcp, enabled: on } })
      await renderApp(<SettingsScreen />, fake)
      const runs = await screen.findByRole('region', { name: 'Agent runs' })
      const access = screen.getByRole('region', { name: 'Agent access' })
      expect(access.compareDocumentPosition(runs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    },
  )

  it('has no axe problems', async () => {
    await renderApp(<SettingsScreen />, agentRunsFake([COMFY]))
    await section()
    expect(await axeViolations()).toEqual([])
  })
})
