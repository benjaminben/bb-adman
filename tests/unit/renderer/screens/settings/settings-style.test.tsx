// ST-5 (spec/app-style.md "Component by component", "Settings"): every Settings CSS module
// carries the app-style mark, so styling-rules.test.ts holds it to the stricter rules; each
// section is a card with its h2; problem and result lines are notices of their kind, with a
// decorative icon and the words unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import page from '@/renderer/screens/settings/settings-screen/settings-screen.module.css'
import layout from '@/renderer/ui/layout.module.css'
import { renderApp } from '../../render'
import { PORT, connect, mcpFake } from './mcp-fixture'

const SETTINGS = path.resolve('src/renderer/screens/settings')

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

describe('settings: the app style [ST-5]', () => {
  it('marks every Settings CSS module, the page module included', () => {
    const files = cssFiles(SETTINGS)
    expect(files.map((f) => path.relative(SETTINGS, f))).toContain(
      path.join('settings-screen', 'settings-screen.module.css'),
    )
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8').split('\n')[0], file).toBe('/* app-style */')
    }
  })

  it('draws the page with its h2 as the page title', async () => {
    await renderApp(<SettingsScreen page="agents" />, mcpFake(connect()).fake)
    const region = screen.getByRole('region', { name: 'Settings' })
    expect(page.screen).toBeTruthy()
    expect(region).toHaveClass(page.screen as string)
    await within(region).findByRole('region', { name: 'Agent access' })
    const [title] = within(region).getAllByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Agents')
    expect(title).toHaveClass(page.title as string)
  })

  it('draws the agent access state line as a warn notice', async () => {
    await renderApp(
      <SettingsScreen page="agents" />,
      mcpFake(connect({ problem: 'port_in_use' })).fake,
    )
    const text = `Port ${PORT} is in use. Choose another.`
    const line = await screen.findByText(text)
    expect(line).toHaveClass(layout.notice as string, layout.warn as string)
    expect(line).toHaveTextContent(text)
  })

  it.each(['ok', 'danger', 'warn'] as const)(
    'draws a %s line with a hidden icon and the words as given',
    (kind) => {
      render(
        <NoticeLine kind={kind} id="line-id">
          A made-up line.
        </NoticeLine>,
      )
      const line = screen.getByText('A made-up line.')
      expect(line).toHaveAttribute('id', 'line-id')
      expect(line).toHaveClass(layout.notice as string, layout[kind] as string)
      expect(line.textContent).toBe('A made-up line.')
      expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    },
  )
})
