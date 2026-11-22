// SET-5 (spec/phases/design-wave-screens-a.md, "SET-5 — Agents page"; OI-DW-4): Agent access as
// a Section with its switch in the header, Connect folded with the token masked, the auto-delete
// Switch with its short warning on the page, and Agent runs as rows with one paid line. Checks
// on the token compare with booleans, so a failure never prints it.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'
import { OFF, TOKEN, connect, mcpFake } from './mcp-fixture'
import { COMFY, PAID, agentRunsFake, provider } from './agent-runs-fixture'
import { openConnect } from './connect-steps'

const ACCESS = 'Turn on agent access'
const SHORT = 'Deletes cannot be undone.'
const CLOUD = provider({ id: 'cloud', label: 'Cloud Pictures', local: false })

const access = () => screen.findByRole('region', { name: 'Agent access' })
const runs = async () => within(await screen.findByRole('region', { name: 'Agent runs' }))
const pageHasToken = () => document.body.innerHTML.includes(TOKEN)
const names = (fake: { commands: Array<{ name: string }> }) => fake.commands.map((c) => c.name)

function mockClipboard() {
  const spy = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true })
  return spy
}

function attributesHoldToken(): boolean {
  return Array.from(document.body.querySelectorAll('*')).some((el) =>
    Array.from(el.attributes).some((a) => a.value.includes(TOKEN)),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Agents page: Agent access [SET-5]', () => {
  it('puts the switch in the Agent access header, with On or Off beside it', async () => {
    const { fake, setInfo } = mcpFake(OFF)
    await renderApp(<SettingsScreen page="agents" />, fake)
    const box = await access()
    const head = box.querySelector('h3')?.parentElement as HTMLElement
    const toggle = await within(head).findByRole('switch', { name: ACCESS })
    expect(within(head).getByText('Off')).toBeVisible()
    setInfo(connect())
    await userEvent.click(toggle)
    expect(fake.commands).toContainEqual({ name: 'mcp.setEnabled', input: { enabled: true } })
    expect(await within(head).findByText('On')).toBeVisible()
  })

  it('shows "New token", named "Make a new token", which sends mcp.regenerateToken', async () => {
    const { fake } = mcpFake(connect())
    await renderApp(<SettingsScreen page="agents" />, fake)
    const button = await within(await access()).findByRole('button', { name: 'Make a new token' })
    expect(button).toHaveTextContent('New token')
    await userEvent.click(button)
    expect(fake.commands).toContainEqual({ name: 'mcp.regenerateToken', input: {} })
  })

  it('draws no Connect while access is off', async () => {
    await renderApp(<SettingsScreen page="agents" />, mcpFake(OFF).fake)
    const box = await access()
    await within(box).findByRole('switch', { name: ACCESS })
    expect(within(box).queryByRole('region', { name: 'Connect to Claude' })).toBeNull()
  })

  it('starts Connect folded, and keeps the token out of the page until Show', async () => {
    const desktop = '{ "mcpServers": { "adman": { "args": ["--mcp-bridge"] } } }'
    await renderApp(
      <SettingsScreen page="agents" />,
      mcpFake(connect({ claudeDesktop: desktop })).fake,
    )
    const box = await access()
    const panel = await within(box).findByRole('region', { name: 'Connect to Claude' })
    const head = within(panel).getByRole('button', { name: 'Connect to Claude' })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(within(panel).getByText('Claude Code · Claude Desktop')).toBeInTheDocument()
    await openConnect(box)
    expect(within(panel).getByText('Address')).toBeVisible()
    expect(within(panel).getByText('Access token')).toBeVisible()
    expect(pageHasToken()).toBe(false)
    await userEvent.click(within(panel).getByRole('button', { name: 'Show' }))
    expect(pageHasToken()).toBe(true)
    expect(attributesHoldToken()).toBe(false)
    await userEvent.click(within(panel).getByRole('button', { name: 'Hide' }))
    expect(pageHasToken()).toBe(false)
  })

  it('copies the token only on a click of "Copy token", while it is masked', async () => {
    const writeText = mockClipboard()
    await renderApp(<SettingsScreen page="agents" />, mcpFake(connect()).fake)
    const panel = await openConnect(await access())
    expect(writeText).not.toHaveBeenCalled()
    await userEvent.click(within(panel).getByRole('button', { name: 'Copy token' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]?.[0] === TOKEN).toBe(true)
    expect(pageHasToken()).toBe(false)
    await userEvent.click(within(panel).getByRole('button', { name: 'Copy address' }))
    expect(writeText.mock.calls[1]?.[0]).toBe(connect().address)
  })

  it('puts the token in no name, title, attribute, store or console line', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')]
    mockClipboard()
    const { store } = await renderApp(<SettingsScreen page="agents" />, mcpFake(connect()).fake)
    const box = await access()
    const panel = await openConnect(box)
    await userEvent.click(within(panel).getByRole('button', { name: 'Copy token' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Show' }))
    expect(attributesHoldToken()).toBe(false)
    const named = within(box)
      .queryAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
    expect(named.some((n) => n?.includes(TOKEN))).toBe(false)
    expect(JSON.stringify(store.getState()).includes(TOKEN)).toBe(false)
    expect(JSON.stringify(spies.flatMap((s) => s.mock.calls)).includes(TOKEN)).toBe(false)
  })

  it('draws the auto-delete Switch described by its visible short warning', async () => {
    const { fake } = mcpFake(connect())
    await renderApp(<SettingsScreen page="agents" />, fake)
    const box = await access()
    const sw = await within(box).findByRole('switch', { name: 'Delete without asking' })
    expect(within(box).getByText(SHORT)).toBeVisible()
    expect(sw).toHaveAccessibleDescription(SHORT)
    expect(within(box).getByRole('button', { name: 'About deleting without asking' })).toBeVisible()
    await userEvent.click(sw)
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { mcp: { autoApproveDestructive: true } },
    })
  })

  it('keeps the longer delete warning in the InfoTip, and the short line on the page', async () => {
    await renderApp(<SettingsScreen page="agents" />, mcpFake(connect()).fake)
    const box = await access()
    const tip = await within(box).findByRole('button', { name: 'About deleting without asking' })
    await userEvent.click(tip)
    expect(
      within(box).getByText(/deleting a variant clears its campaign's undo list/),
    ).toBeVisible()
    expect(within(box).getByText(SHORT)).toBeVisible()
  })

  it('reads the Claude Desktop sentence from its InfoTip', async () => {
    const desktop = '{ "mcpServers": { "adman": { "args": ["--mcp-bridge"] } } }'
    await renderApp(
      <SettingsScreen page="agents" />,
      mcpFake(connect({ claudeDesktop: desktop })).fake,
    )
    const panel = await openConnect(await access())
    await userEvent.click(within(panel).getByRole('button', { name: 'About Claude Desktop' }))
    const words = "Add this to Claude Desktop's configuration file, then restart Claude Desktop."
    expect(within(panel).getByText(words)).toBeVisible()
  })

  it('masks a new token again after "Make a new token"', async () => {
    const NEW = 'another-made-up-test-token'
    const { fake, setInfo } = mcpFake(connect())
    await renderApp(<SettingsScreen page="agents" />, fake)
    const box = await access()
    const panel = await openConnect(box)
    await userEvent.click(within(panel).getByRole('button', { name: 'Show' }))
    expect(pageHasToken()).toBe(true)
    setInfo(connect({ token: NEW, claudeCode: `Bearer ${NEW}` }))
    await userEvent.click(within(box).getByRole('button', { name: 'Make a new token' }))
    await within(panel).findByRole('button', { name: 'Show' })
    expect(document.body.innerHTML.includes(NEW)).toBe(false)
  })

  it('sends the port with settings.update, as before', async () => {
    const { fake } = mcpFake(connect())
    await renderApp(<SettingsScreen page="agents" />, fake)
    const box = await access()
    const field = await within(box).findByLabelText('Port')
    await userEvent.clear(field)
    await userEvent.type(field, '48000')
    await userEvent.type(field, '{Enter}')
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { mcp: { port: 48000 } },
    })
  })

  it('has no axe violations with Connect folded and open', async () => {
    await renderApp(<SettingsScreen page="agents" />, mcpFake(connect()).fake)
    const box = await access()
    await within(box).findByRole('region', { name: 'Connect to Claude' })
    expect(await axeViolations()).toEqual([])
    const panel = await openConnect(box)
    expect(await axeViolations()).toEqual([])
    await userEvent.click(within(panel).getByRole('button', { name: 'Show' }))
    expect(await axeViolations()).toEqual([])
  })
})

describe('Agents page: Agent runs [SET-5]', () => {
  it('shows the paid sentence once, describing each paid Switch', async () => {
    await renderApp(<SettingsScreen page="agents" />, agentRunsFake([COMFY, CLOUD]))
    const box = await runs()
    expect(box.getAllByText(PAID)).toHaveLength(1)
    for (const label of ['Cloud Pictures', 'Google Gemini']) {
      const sw = box.getByRole('switch', { name: `Let agents start runs with ${label}` })
      expect(sw).toHaveAccessibleDescription(PAID)
    }
    const comfy = box.getByRole('switch', { name: 'Let agents start runs with ComfyUI' })
    expect(comfy).not.toHaveAccessibleDescription()
    expect(await axeViolations()).toEqual([])
  })

  it('marks each paid row "Paid", and the local row not', async () => {
    await renderApp(<SettingsScreen page="agents" />, agentRunsFake([COMFY, CLOUD]))
    const box = await runs()
    expect(box.getAllByText('Paid')).toHaveLength(2)
    expect(box.getAllByTitle('Each run is charged to your account')).toHaveLength(2)
  })

  it('has no paid line with only local providers offered', async () => {
    const fake = makeFakeApi(baseState({ providers: [COMFY] }))
    await renderApp(<SettingsScreen page="agents" />, fake)
    expect((await runs()).queryByText(PAID)).toBeNull()
  })

  it('reads "1 on" in the header with one provider allowed', async () => {
    const fake = agentRunsFake([COMFY], { agentRuns: { comfyui: { allowed: true } } })
    await renderApp(<SettingsScreen page="agents" />, fake)
    const region = await screen.findByRole('region', { name: 'Agent runs' })
    expect(within(region).getByText('1 on')).toBeInTheDocument()
  })

  it('sends agentRuns.setAllowed and agentRuns.setLimit as before', async () => {
    const fake = agentRunsFake([COMFY])
    await renderApp(<SettingsScreen page="agents" />, fake)
    const box = await runs()
    await userEvent.click(box.getByRole('switch', { name: 'Let agents start runs with ComfyUI' }))
    fireEvent.change(box.getByLabelText('Run limit'), { target: { value: '7' } })
    await waitFor(() =>
      expect(fake.commands.map((c) => c.input)).toEqual([
        { provider: 'comfyui', allowed: true },
        { limit: 7 },
      ]),
    )
    expect(names(fake)).toEqual(['agentRuns.setAllowed', 'agentRuns.setLimit'])
    expect(box.getByText('per provider')).toBeInTheDocument()
    expect(box.getByRole('button', { name: 'About run limit' })).toBeInTheDocument()
  })
})
