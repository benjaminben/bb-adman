// P7-15: with the real registry's fal.ai Seedance row (now available), Settings shows its key
// row in place of "Not yet available", and an agent tick with the paid line Gemini has.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { listProviders } from '@/main/providers/registry'
import { renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'
import { PAID, tickName } from './agent-runs-fixture'

function withRealFal() {
  const real = listProviders({}).find((p) => p.id === 'fal-seedance')
  if (!real) throw new Error('no fal row')
  const base = baseState()
  const providers = base.providers.map((p) => (p.id === 'fal-seedance' ? real : p))
  return makeFakeApi(baseState({ providers }))
}

describe('Settings with fal.ai Seedance switched on [P7-15]', () => {
  it('shows the fal key row, not "Not yet available"', async () => {
    await renderApp(<SettingsScreen />, withRealFal())
    const keys = within(await screen.findByRole('heading', { name: 'Keys' }).then(card))
    const fal = keys.getByRole('group', { name: /^fal\.ai Seedance/ })
    expect(within(fal).queryByText('Not yet available')).toBeNull()
    expect(within(fal).getByText('Not set')).toBeInTheDocument()
    expect(within(fal).getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('offers the agent tick for fal with the paid line', async () => {
    await renderApp(<SettingsScreen />, withRealFal())
    const box = within(await screen.findByRole('region', { name: 'Agent runs' }))
    const tick = box.getByRole('checkbox', { name: tickName('fal.ai Seedance') })
    expect(tick).toHaveAccessibleDescription(PAID)
  })
})

function card(heading: HTMLElement): HTMLElement {
  const parent = heading.parentElement
  if (!parent) throw new Error('no card')
  return parent
}
