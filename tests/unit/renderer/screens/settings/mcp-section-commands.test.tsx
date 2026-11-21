import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../../../../../src/renderer/screens/settings/settings-screen'
import { renderApp } from '../../render'
import { heldReply } from '../campaign/held-reply'
import { OFF, PORT, connect, line, mcpFake, refused } from './mcp-fixture'

const NEW_TOKEN = 'another-made-up-test-token'
const IN_USE = `Port ${PORT} is in use. Choose another.`

async function section() {
  return screen.findByRole('region', { name: 'Agent access' })
}

async function toggle(box: HTMLElement) {
  return within(box).findByRole('switch', { name: 'Turn on agent access' })
}

describe('settings: agent access commands [SPEC 4.2, 5.3, 6.8; 14 1.56 MCP-C]', () => {
  it('the switch sends mcp.setEnabled and reads the panel again', async () => {
    const { fake, setInfo, reads } = mcpFake(OFF)
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const before = reads()
    setInfo(connect())
    await userEvent.click(await toggle(box))
    expect(fake.commands).toContainEqual({ name: 'mcp.setEnabled', input: { enabled: true } })
    expect(await within(box).findByText(line())).toBeInTheDocument()
    expect(reads()).toBe(before + 1)
  })

  it('turning the switch off sends enabled false', async () => {
    const { fake, setInfo } = mcpFake(connect())
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    setInfo(OFF)
    await userEvent.click(await toggle(box))
    expect(fake.commands).toContainEqual({ name: 'mcp.setEnabled', input: { enabled: false } })
    await waitFor(() => expect(within(box).queryByText(line())).toBeNull())
  })

  it('a refused switch shows the sentence and still reads the panel again', async () => {
    const { fake, reads } = mcpFake(OFF)
    fake.onCommand('mcp.setEnabled', () => refused(IN_USE, 'port_in_use'))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const before = reads()
    await userEvent.click(await toggle(box))
    expect(await within(box).findByText(IN_USE)).toBeInTheDocument()
    expect(reads()).toBe(before + 1)
    expect(await toggle(box)).not.toBeChecked()
  })

  it('a second click while the switch is sending sends nothing', async () => {
    const { fake } = mcpFake(OFF)
    const held = heldReply()
    fake.onCommand('mcp.setEnabled', held.answer)
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const sw = await toggle(box)
    await userEvent.click(sw)
    expect(sw).toBeDisabled()
    expect(within(box).getByRole('button', { name: 'Make a new token' })).toBeDisabled()
    expect(within(box).getByRole('button', { name: 'Save port' })).toBeDisabled()
    await userEvent.click(sw)
    held.release({ ok: true, data: { enabled: true } })
    await waitFor(() => expect(sw).toBeEnabled())
    expect(fake.commands.filter((c) => c.name === 'mcp.setEnabled')).toHaveLength(1)
  })

  it('Save port sends settings.update with the number and reads the panel again', async () => {
    const { fake, setInfo, reads } = mcpFake(connect())
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const field = await within(box).findByLabelText('Port')
    await userEvent.clear(field)
    await userEvent.type(field, '48000')
    const before = reads()
    setInfo(connect({ port: 48000, claudeCode: line(48000) }))
    await userEvent.click(within(box).getByRole('button', { name: 'Save port' }))
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { mcp: { port: 48000 } },
    })
    expect(await within(box).findByText(line(48000))).toBeInTheDocument()
    expect(reads()).toBe(before + 1)
  })

  it('a refused port shows the sentence under the field and still reads the panel again', async () => {
    const { fake, reads } = mcpFake(connect())
    const sentence = 'Choose a port from 1024 to 65535.'
    fake.onCommand('settings.update', () => refused(sentence))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const field = await within(box).findByLabelText('Port')
    await userEvent.clear(field)
    await userEvent.type(field, '80')
    const before = reads()
    await userEvent.click(within(box).getByRole('button', { name: 'Save port' }))
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
    expect(field).toHaveAccessibleDescription(sentence)
    expect(reads()).toBe(before + 1)
  })

  it('Make a new token sends mcp.regenerateToken and shows the new line', async () => {
    const { fake, setInfo, reads } = mcpFake(connect())
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await within(box).findByText(line())
    const before = reads()
    setInfo(connect({ token: NEW_TOKEN, claudeCode: line(PORT, NEW_TOKEN) }))
    await userEvent.click(within(box).getByRole('button', { name: 'Make a new token' }))
    expect(fake.commands).toContainEqual({ name: 'mcp.regenerateToken', input: {} })
    expect(await within(box).findByText(line(PORT, NEW_TOKEN))).toBeInTheDocument()
    expect(reads()).toBe(before + 1)
  })

  it('a refused new token still reads the panel again, which shows the saved token', async () => {
    // REVIEW MCP-A point 7.2: the token is saved, then the taken port refuses the start.
    const { fake, setInfo, reads } = mcpFake(connect())
    fake.onCommand('mcp.regenerateToken', () => refused(IN_USE, 'port_in_use'))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    await within(box).findByText(line())
    const before = reads()
    setInfo(
      connect({
        running: false,
        problem: 'port_in_use',
        token: NEW_TOKEN,
        claudeCode: line(PORT, NEW_TOKEN),
      }),
    )
    await userEvent.click(within(box).getByRole('button', { name: 'Make a new token' }))
    expect(await within(box).findByText(line(PORT, NEW_TOKEN))).toBeInTheDocument()
    expect(within(box).getAllByText(IN_USE).length).toBeGreaterThan(0)
    expect(reads()).toBe(before + 1)
  })
})
