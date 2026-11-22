// SET-1 (spec/phases/design-wave-screens-a.md, choice C-1): Settings is a side list of four
// pages. The chosen page lasts for the window's session; the Setup button sits at the list's foot.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { rememberPage } from '@/renderer/screens/settings/settings-screen/settings-pages'
import { FirstRun, closeSetup } from '@/renderer/app/first-run'
import { renderApp, axeViolations } from '../../render'
import { connect, mcpFake } from './mcp-fixture'

const nav = () => within(screen.getByRole('navigation', { name: 'Settings pages' }))
const item = (name: string) => nav().getByRole('button', { name })

beforeEach(() => rememberPage('ai'))
afterEach(() => closeSetup())

describe('settings: a side list of four pages [SET-1, C-1]', () => {
  it('lists the four pages in order, AI services first and current', async () => {
    await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    const names = nav()
      .getAllByRole('listitem')
      .map((li) => within(li).getByRole('button').textContent)
    expect(names).toEqual(['AI services', 'Files', 'Publish', 'Agents'])
    expect(item('AI services')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'AI services' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('shows Agents on a click, moves aria-current, and remembers it on the next mount', async () => {
    const view = await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    await userEvent.click(item('Agents'))
    expect(await screen.findByRole('region', { name: 'Agent access' })).toBeInTheDocument()
    expect(item('Agents')).toHaveAttribute('aria-current', 'page')
    expect(item('AI services')).not.toHaveAttribute('aria-current')
    view.unmount()
    await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    expect(item('Agents')).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('region', { name: 'Agent access' })).toBeInTheDocument()
  })

  it('opens on the page it is given', async () => {
    await renderApp(<SettingsScreen page="files" />, mcpFake(connect()).fake)
    expect(item('Files')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Change default location' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Google Gemini API key' })).toBeNull()
  })

  it("holds the Setup button at the list's foot, which opens the setup", async () => {
    await renderApp(
      <>
        <SettingsScreen />
        <FirstRun />
      </>,
      mcpFake(connect()).fake,
    )
    const setup = item('Open the setup…')
    expect(setup).toHaveTextContent('Setup')
    await userEvent.click(setup)
    expect(screen.getByRole('dialog', { name: 'Set up AdManager' })).toBeInTheDocument()
  })

  it('tabs through the side list first, then the page', async () => {
    await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
    for (const name of ['AI services', 'Files', 'Publish', 'Agents', 'Open the setup…']) {
      await userEvent.tab()
      expect(item(name)).toHaveFocus()
    }
    await userEvent.tab()
    const page = screen.getByRole('region', { name: 'AI services' })
    expect(page).toContainElement(document.activeElement as HTMLElement)
  })

  it.each(['AI services', 'Files', 'Publish', 'Agents'])(
    'has no axe violations on %s',
    async (name) => {
      await renderApp(<SettingsScreen />, mcpFake(connect()).fake)
      await userEvent.click(item(name))
      await screen.findByRole('region', { name })
      expect(await axeViolations()).toEqual([])
    },
  )
})
