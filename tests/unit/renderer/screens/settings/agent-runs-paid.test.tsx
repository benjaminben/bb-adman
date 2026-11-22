// spec/agent-runs.md "Settings block", item 2: the paid line under a provider whose `local` is
// false.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { COMFY, PAID, agentRunsFake, provider, tickName } from './agent-runs-fixture'

const CLOUD = provider({ id: 'cloud', label: 'Cloud Pictures', local: false })

describe('settings: agent runs, the paid line [spec/agent-runs.md, Settings block 2]', () => {
  // The base state adds Google Gemini, also not local.
  it('shows the paid line under each provider whose local is false, and only there', async () => {
    await renderApp(<SettingsScreen page="agents" />, agentRunsFake([COMFY, CLOUD]))
    const box = within(await screen.findByRole('region', { name: 'Agent runs' }))
    expect(box.getAllByText(PAID)).toHaveLength(1)
    for (const label of ['Cloud Pictures', 'Google Gemini']) {
      expect(box.getByRole('switch', { name: tickName(label) })).toHaveAccessibleDescription(PAID)
    }
    expect(box.getByRole('switch', { name: tickName('ComfyUI') })).not.toHaveAccessibleDescription()
    expect(await axeViolations()).toEqual([])
  })
})
