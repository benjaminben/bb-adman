// REVIEW-Phase2-MCP-C choice 6e: a refusal line does not outlive a later successful command
// of the other kind (SPEC 6.8; 14 1.56 MCP-C).
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../../../../../src/renderer/screens/settings/settings-screen'
import { renderApp } from '../../render'
import { OFF, PORT, connect, line, mcpFake, refused } from './mcp-fixture'

const IN_USE = `Port ${PORT} is in use. Choose another.`
const RANGE = 'Choose a port from 1024 to 65535.'

async function section() {
  return screen.findByRole('region', { name: 'Agent access' })
}

describe('settings: agent access refusal lines are cleared [REVIEW MCP-C 6e]', () => {
  it('a refused switch line goes after a port is saved', async () => {
    const { fake } = mcpFake(OFF)
    fake.onCommand('mcp.setEnabled', () => refused(IN_USE, 'port_in_use'))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await userEvent.click(await within(box).findByRole('switch'))
    expect(await within(box).findByText(IN_USE)).toBeInTheDocument()
    const field = within(box).getByLabelText('Port')
    await userEvent.clear(field)
    await userEvent.type(field, '48000')
    await userEvent.click(within(box).getByRole('button', { name: 'Save port' }))
    await waitFor(() => expect(within(box).queryByText(IN_USE)).toBeNull())
  })

  it('a refused port line goes after the switch is turned on', async () => {
    const { fake, setInfo } = mcpFake(OFF)
    fake.onCommand('settings.update', () => refused(RANGE))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const field = await within(box).findByLabelText('Port')
    await userEvent.clear(field)
    await userEvent.type(field, '80')
    await userEvent.click(within(box).getByRole('button', { name: 'Save port' }))
    expect(await within(box).findByText(RANGE)).toBeInTheDocument()
    setInfo(connect())
    await userEvent.click(within(box).getByRole('switch'))
    expect(await within(box).findByText(line())).toBeInTheDocument()
    expect(within(box).queryByText(RANGE)).toBeNull()
    expect(field).not.toHaveAccessibleDescription(RANGE)
  })

  it('a refused switch line goes after a new token is made', async () => {
    const { fake } = mcpFake(OFF)
    fake.onCommand('mcp.setEnabled', () => refused(IN_USE, 'port_in_use'))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await userEvent.click(await within(box).findByRole('switch'))
    expect(await within(box).findByText(IN_USE)).toBeInTheDocument()
    await userEvent.click(within(box).getByRole('button', { name: 'Make a new token' }))
    await waitFor(() => expect(within(box).queryByText(IN_USE)).toBeNull())
  })
})
