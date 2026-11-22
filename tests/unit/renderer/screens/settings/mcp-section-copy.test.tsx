// The Copy button beside the connect line, and a refused mcp.getConnectInfo
// (SPEC 14 1.59 L-20, L-21). navigator.clipboard is a mock. Checks compare the copied text
// with a boolean, so a failure never prints the line or the made-up token.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { TOKEN, connect, line, mcpFake } from './mcp-fixture'
import { openConnect } from './connect-steps'

const FAILED = 'Copy did not work. Select the line and copy it.'

function mockClipboard(writeText: (text: string) => Promise<void>) {
  const spy = vi.fn(writeText)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: spy },
    configurable: true,
  })
  return spy
}

async function openPanel() {
  const user = userEvent.setup()
  const { fake } = mcpFake(connect())
  await renderApp(<SettingsScreen page="agents" />, fake)
  const box = await screen.findByRole('region', { name: 'Agent access' })
  const panel = await openConnect(box)
  return { user, box, panel }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settings: copy the connect line [SPEC 14 1.59 L-20]', () => {
  it('copies exactly the Claude Code line once, then reads "Copied"', async () => {
    const { user, panel } = await openPanel()
    const writeText = mockClipboard(async () => {})
    await user.click(within(panel).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]?.[0] === line()).toBe(true)
    expect(await within(panel).findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(within(panel).queryByText(FAILED)).toBeNull()
  })

  it('a refused copy says to select the line, and logs nothing about the token', async () => {
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const { user, panel } = await openPanel()
    mockClipboard(async () => {
      throw new Error('denied')
    })
    await user.click(within(panel).getByRole('button', { name: 'Copy' }))
    expect(await within(panel).findByText(FAILED)).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Copied' })).toBeNull()
    const calls = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]
    expect(JSON.stringify(calls).includes(TOKEN)).toBe(false)
  })

  it('a double click copies the same line and breaks nothing', async () => {
    const { user, panel } = await openPanel()
    const writeText = mockClipboard(async () => {})
    await user.dblClick(within(panel).getByRole('button', { name: 'Copy' }))
    expect(writeText.mock.calls.every((c) => c[0] === line())).toBe(true)
    expect(await within(panel).findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('puts the token in no attribute after a copy', async () => {
    const { user, panel } = await openPanel()
    mockClipboard(async () => {})
    await user.click(within(panel).getByRole('button', { name: 'Copy' }))
    await within(panel).findByRole('button', { name: 'Copied' })
    const values = Array.from(document.body.querySelectorAll('*')).flatMap((el) =>
      Array.from(el.attributes).map((a) => a.value),
    )
    expect(values.some((v) => v.includes(TOKEN))).toBe(false)
  })

  it('has no axe violations after a refused copy', async () => {
    const { user, panel } = await openPanel()
    mockClipboard(async () => {
      throw new Error('denied')
    })
    await user.click(within(panel).getByRole('button', { name: 'Copy' }))
    await within(panel).findByText(FAILED)
    expect(await axeViolations()).toEqual([])
  })
})

describe('settings: a refused mcp.getConnectInfo [SPEC 14 1.59 L-21]', () => {
  const MESSAGE = 'This query is not available.'

  async function refusedSection() {
    const { fake } = mcpFake()
    fake.onQuery('mcp.getConnectInfo', () => ({
      ok: false,
      error: { code: 'AGENT_DENIED', message: MESSAGE },
    }))
    await renderApp(<SettingsScreen page="agents" />, fake)
    return screen.findByRole('region', { name: 'Agent access' })
  }

  it('shows the heading and the query message, and no switch', async () => {
    const box = await refusedSection()
    expect(within(box).getByRole('heading', { name: 'Agent access' })).toBeInTheDocument()
    expect(await within(box).findByText(MESSAGE)).toBeInTheDocument()
    expect(within(box).queryByRole('switch')).toBeNull()
  })

  it('has no axe violations with the refusal line', async () => {
    const box = await refusedSection()
    await within(box).findByText(MESSAGE)
    expect(await axeViolations()).toEqual([])
  })
})
