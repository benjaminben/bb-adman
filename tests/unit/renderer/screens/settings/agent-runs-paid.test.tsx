// spec/agent-runs.md "Settings block", item 2: the paid line under a provider whose `local` is
// false. agentRunsOffered refuses such a provider until AR-2, so this file stands in a copy
// without that step, as the function will be once the untick check is built.
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { renderApp, axeViolations } from '../../render'
import { COMFY, PAID, agentRunsFake, provider, tickName } from './agent-runs-fixture'

vi.mock('@/shared/config/agent-runs', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/config/agent-runs')>()
  return {
    ...real,
    agentRunsOffered: (info: { available: boolean; jobs: string[] }) =>
      info.available && (info.jobs.includes('image') || info.jobs.includes('video'))
        ? null
        : 'agent_runs_not_offered',
  }
})

const CLOUD = provider({ id: 'cloud', label: 'Cloud Pictures', local: false })

describe('settings: agent runs, the paid line [spec/agent-runs.md, Settings block 2]', () => {
  // The base state adds Google Gemini, also not local.
  it('shows the paid line under each provider whose local is false, and only there', async () => {
    await renderApp(<SettingsScreen />, agentRunsFake([COMFY, CLOUD]))
    const box = within(await screen.findByRole('region', { name: 'Agent runs' }))
    expect(box.getAllByText(PAID)).toHaveLength(2)
    for (const label of ['Cloud Pictures', 'Google Gemini']) {
      expect(box.getByRole('checkbox', { name: tickName(label) })).toHaveAccessibleDescription(PAID)
    }
    expect(
      box.getByRole('checkbox', { name: tickName('ComfyUI') }),
    ).not.toHaveAccessibleDescription()
    expect(await axeViolations()).toEqual([])
  })
})
