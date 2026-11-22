// R3-2: the keys list and the agent-run ticks name the models a provider runs.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProviderRow } from '@/renderer/screens/settings/agent-runs-section/provider-row'
import { KeyRow } from '@/renderer/screens/settings/key-row/key-row'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'

const GEMINI: ProviderInfo = {
  id: 'gemini',
  label: 'Google Gemini',
  jobs: ['image', 'layout', 'text'],
  available: true,
  secrets: ['gemini.apiKey'],
  defaultModels: { image: 'a', layout: 'b', text: 'b' },
  modelLabels: {
    image: 'Nano Banana 2.1',
    layout: 'Gemini 3.5 Flash-Lite',
    text: 'Gemini 3.5 Flash-Lite',
  },
  local: false,
  cancel: 'none',
  serverText: false,
}

describe('Settings names the models [R3-2]', () => {
  it('names the models a key unlocks under the key’s row', async () => {
    await renderApp(
      <KeyRow provider={GEMINI} name="gemini.apiKey" />,
      makeFakeApi(baseState({ providers: [GEMINI] })),
    )
    expect(screen.getByText('Nano Banana 2.1, Gemini 3.5 Flash-Lite')).toBeVisible()
  })

  it('names the models beside an agent-run tick, keeping the tick’s name', () => {
    render(<ProviderRow provider={GEMINI} allowed={false} refusal={null} onChange={() => {}} />)
    expect(screen.getByText('Nano Banana 2.1, Gemini 3.5 Flash-Lite')).toBeVisible()
    expect(
      screen.getByRole('switch', { name: 'Let agents start runs with Google Gemini' }),
    ).toBeInTheDocument()
  })
})
