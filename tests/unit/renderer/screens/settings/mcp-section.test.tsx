import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import layout from '@/renderer/ui/layout.module.css'
import { renderApp, axeViolations } from '../../render'
import { OFF, PORT, TOKEN, connect, line, mcpFake } from './mcp-fixture'

async function section() {
  return screen.findByRole('region', { name: 'Agent access' })
}

const PORT_LINE = `Port ${PORT} is in use. Choose another.`
const TOKEN_LINE = 'There is no access token. Make a new token.'
const START_LINE = 'The MCP server could not start. Turn it off and on to try again.'

describe('settings: agent access states [SPEC 6.8; 14 1.56 MCP-C, 1.58 J-8, J-9, J-11]', () => {
  it('off: the switch is off, the port is shown, and no token or connect line is drawn', async () => {
    const { fake } = mcpFake(OFF)
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const toggle = await within(box).findByRole('switch', { name: 'Turn on agent access' })
    expect(toggle).not.toBeChecked()
    expect(within(box).getByLabelText('Port')).toHaveValue(PORT)
    expect(within(box).queryByRole('region', { name: 'Connect to Claude' })).toBeNull()
    expect(document.body.innerHTML).not.toContain(TOKEN)
    expect(within(box).queryByText(PORT_LINE)).toBeNull()
  })

  it('on and running: one Connect block with the Claude Code line, and no state line', async () => {
    const { fake } = mcpFake(connect())
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    expect(await within(box).findByRole('switch', { name: 'Turn on agent access' })).toBeChecked()
    const panel = within(box).getByRole('region', { name: 'Connect to Claude' })
    expect(within(panel).getByText(line())).toBeInTheDocument()
    expect(panel.querySelectorAll('pre')).toHaveLength(1)
    expect(within(panel).queryByText(/Claude Desktop/)).toBeNull()
    expect(within(box).queryByText(PORT_LINE)).toBeNull()
    expect(within(box).queryByText(TOKEN_LINE)).toBeNull()
  })

  it('on with the port taken: says so with the port number', async () => {
    const { fake } = mcpFake(connect({ running: false, problem: 'port_in_use' }))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    expect(await within(box).findByText(PORT_LINE)).toBeInTheDocument()
    expect(within(box).getByRole('switch', { name: 'Turn on agent access' })).toBeChecked()
  })

  it('on with no token: says so beside the Make a new token button, and draws no line', async () => {
    const info = connect({
      running: false,
      problem: 'token_missing',
      token: null,
      claudeCode: null,
    })
    await renderApp(<SettingsScreen />, mcpFake(info).fake)
    const box = await section()
    expect(await within(box).findByText(TOKEN_LINE)).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Make a new token' })).toBeInTheDocument()
    expect(within(box).queryByRole('region', { name: 'Connect to Claude' })).toBeNull()
  })

  it('draws nothing from the reply while the query is refused', async () => {
    const { fake } = mcpFake()
    fake.onQuery('mcp.getConnectInfo', () => ({
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong.' },
    }))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    expect(within(box).queryByRole('switch')).toBeNull()
  })

  it('puts the token in no attribute, title or console line, and only inside the panel', async () => {
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const { fake } = mcpFake(connect())
    const { store } = await renderApp(<SettingsScreen />, fake)
    const box = await section()
    const panel = await within(box).findByRole('region', { name: 'Connect to Claude' })
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) expect(attr.value).not.toContain(TOKEN)
    }
    expect(document.title).not.toContain(TOKEN)
    const outside = document.body.cloneNode(true) as HTMLElement
    outside.querySelector('[aria-labelledby="mcp-connect-title"]')?.remove()
    expect(outside.innerHTML).not.toContain(TOKEN)
    expect(panel.textContent).toContain(TOKEN)
    expect(JSON.stringify(store.getState())).not.toContain(TOKEN)
    const calls = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]
    expect(JSON.stringify(calls)).not.toContain(TOKEN)
    vi.restoreAllMocks()
  })

  it('has no axe violations when on and running', async () => {
    await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    await within(await section()).findByRole('region', { name: 'Connect to Claude' })
    expect(await axeViolations()).toEqual([])
  })

  it('on but the start failed: says to turn it off and on [SPEC 14 1.59 L-10]', async () => {
    const { fake } = mcpFake(connect({ running: false, problem: 'start_failed' }))
    await renderApp(<SettingsScreen />, fake)
    const box = await section()
    expect(await within(box).findByText(START_LINE)).toBeInTheDocument()
    expect(within(box).getByRole('switch', { name: 'Turn on agent access' })).toBeChecked()
    expect(within(box).queryByText(PORT_LINE)).toBeNull()
  })

  it('has no axe violations with a state line', async () => {
    await renderApp(<SettingsScreen />, mcpFake(connect({ problem: 'port_in_use' })).fake)
    await within(await section()).findByText(PORT_LINE)
    expect(await axeViolations()).toEqual([])
  })

  it('draws the toggle as a switch and keeps its role, name and checked state [ST-5]', async () => {
    await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    const box = await section()
    const toggle = await within(box).findByRole('switch', { name: 'Turn on agent access' })
    expect(toggle).toBeChecked()
    expect(toggle).toHaveAttribute('type', 'checkbox')
    expect(layout.switch).toBeTruthy()
    expect(toggle).toHaveClass(layout.switch as string)
  })
})
