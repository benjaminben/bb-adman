// CW-7 (spec/comfyui-custom.md "The check and what is missing", rule 11): the Settings check
// result lists a custom workflow under its name with the status word "Added" and its missing
// node types, drawn as plain text.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { renderApp } from '../../render'
import { ADDRESS, comfyFake, info, workflow } from './comfy-fixture'
import { PORTRAIT } from './custom-workflow-fixture'

const MARKUP = '<b>LensFlare</b>'

const check: ComfyCheck = {
  outcome: 'ok',
  version: '0.45.0',
  workflows: [
    { id: 'moss-text-to-image', missing: [] },
    { id: PORTRAIT.id, missing: [{ what: 'node', name: MARKUP }] },
  ],
}

async function pressCheck() {
  const { fake } = comfyFake(info({ workflows: [workflow(), PORTRAIT] }), check)
  await renderApp(<SettingsScreen />, fake)
  const box = await screen.findByRole('region', { name: 'ComfyUI server' })
  await within(box).findByDisplayValue(ADDRESS)
  await userEvent.click(within(box).getByRole('button', { name: 'Check' }))
  return within(await within(box).findByRole('list', { name: 'Workflows' }))
}

describe('settings: the check result of a custom workflow [CW-7]', () => {
  it('lists it by name with the status word "Added" and its missing node type', async () => {
    const list = await pressCheck()
    const row = within(list.getByRole('listitem', { name: PORTRAIT.label }))
    expect(row.getByText('Added')).toBeInTheDocument()
    expect(row.queryByText('custom')).toBeNull()
    expect(row.getByText('Missing 1 item')).toBeInTheDocument()
    expect(row.getByText(`Node ${MARKUP}`)).toBeInTheDocument()
  })

  it('keeps the shipped status word on a shipped row', async () => {
    const list = await pressCheck()
    const row = within(list.getByRole('listitem', { name: 'MOSS picture from a prompt' }))
    expect(row.getByText('trial')).toBeInTheDocument()
  })

  it('draws a node type as text, never as markup [rule 11]', async () => {
    const list = await pressCheck()
    const row = list.getByRole('listitem', { name: PORTRAIT.label })
    expect(row.querySelector('b')).toBeNull()
    expect(row.querySelector('a')).toBeNull()
  })
})
