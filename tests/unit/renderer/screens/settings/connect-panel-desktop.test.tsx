// P10-9 (spec/phases/phase-10.md, "Bridge", A-245): the Connect panel's second block, the
// Claude Desktop entry, drawn as text with its own Copy button. navigator.clipboard is a mock.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { TOKEN, connect, mcpFake } from './mcp-fixture'

const DESKTOP = JSON.stringify(
  {
    mcpServers: {
      adman: { command: '/Applications/Adman.app/Contents/MacOS/Adman', args: ['--mcp-bridge'] },
    },
  },
  null,
  2,
)

function mockClipboard() {
  const spy = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true })
  return spy
}

async function openPanel(claudeDesktop: string | null) {
  const user = userEvent.setup()
  const { fake } = mcpFake(connect({ claudeDesktop }))
  const { container } = await renderApp(<SettingsScreen />, fake)
  const box = await screen.findByRole('region', { name: 'Agent access' })
  const panel = await within(box).findByRole('region', { name: 'Connect to Claude' })
  return { user, panel, container }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settings: the Claude Desktop block [P10-9, A-245]', () => {
  it('shows the entry as text, with no token, under the Claude Code block', async () => {
    const { panel, container } = await openPanel(DESKTOP)
    const block = within(panel).getByRole('region', { name: 'Claude Desktop' })
    const code = block.querySelector('pre code')
    expect(code?.textContent).toBe(DESKTOP)
    expect(block.textContent?.includes(TOKEN)).toBe(false)
    expect(await axeViolations(container)).toEqual([])
  })

  it('Copy copies exactly the entry once, then reads "Copied"', async () => {
    const { user, panel } = await openPanel(DESKTOP)
    const writeText = mockClipboard()
    const block = within(panel).getByRole('region', { name: 'Claude Desktop' })
    await user.click(within(block).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]?.[0]).toBe(DESKTOP)
    expect(await within(block).findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('shows no Claude Desktop block when there is no entry', async () => {
    const { panel } = await openPanel(null)
    expect(within(panel).queryByRole('region', { name: 'Claude Desktop' })).toBeNull()
  })
})
