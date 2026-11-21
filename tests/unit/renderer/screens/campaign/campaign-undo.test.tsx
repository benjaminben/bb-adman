// spec/screens-variants.md, "The overview", campaign-undo/: Undo and Redo for the campaign's
// list, enabled from history.state (read on mount and on each project.changed for the project),
// sending the campaign scope; a refusal goes to the banner. Mod+Z and Mod+Shift+Z act only on
// the overview and never inside a text field. (D-099: deletes are not on this list.)
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import { CampaignUndo } from '@/renderer/screens/campaign/campaign-undo'
import type { NavStore } from '@/renderer/stores/nav-store'
import { axeViolations } from '../../render'
import { P, campaignApi, renderWith } from './campaign-fixture'

const SCOPE = { projectId: P, scope: 'campaign:C1' }

let nav: NavStore | null = null
function Grab() {
  const store = useNavStore()
  useEffect(() => {
    nav = store
  }, [store])
  return null
}

async function draw(state = { canUndo: true, canRedo: true }) {
  const fake = campaignApi()
  fake.onQuery('history.state', () => ({ ok: true, data: state }))
  const view = await renderWith(
    <NavScope>
      <Grab />
      <main>
        <CampaignUndo projectId={P} campaignId="C1" />
        <input aria-label="A text field" />
      </main>
    </NavScope>,
    fake,
  )
  return view
}

const asked = (fake: ReturnType<typeof campaignApi>) =>
  fake.queries.filter((q) => q.name === 'history.state').map((q) => q.input)
const sentHistory = (fake: ReturnType<typeof campaignApi>) =>
  fake.commands.filter((c) => c.name.startsWith('history.')).map((c) => [c.name, c.input])

describe('CampaignUndo', () => {
  it('shows Undo and Redo in a group, enabled from history.state for the campaign scope', async () => {
    const { fake } = await draw({ canUndo: true, canRedo: false })
    const group = screen.getByRole('group', { name: 'Campaign changes' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(group).toContainElement(screen.getByRole('button', { name: 'Undo' }))
    expect(asked(fake)).toEqual([SCOPE])
  })

  it('reads history.state again on project.changed for the project only', async () => {
    const { fake } = await draw()
    await waitFor(() => expect(asked(fake)).toHaveLength(1))
    const changed = { changed: {}, removed: {}, actor: 'user' as const }
    act(() => fake.emit('project.changed', { projectId: 'other', ...changed }))
    act(() => fake.emit('project.changed', { projectId: P, ...changed }))
    await waitFor(() => expect(asked(fake)).toHaveLength(2))
    expect(asked(fake)).toEqual([SCOPE, SCOPE])
  })

  it('sends history.undo and history.redo with the campaign scope, by button and by key', async () => {
    const { fake } = await draw()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await userEvent.keyboard('{Control>}z{/Control}')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await userEvent.keyboard('{Control>}y{/Control}')
    expect(sentHistory(fake)).toEqual([
      ['history.undo', SCOPE],
      ['history.redo', SCOPE],
      ['history.undo', SCOPE],
      ['history.redo', SCOPE],
      ['history.redo', SCOPE],
    ])
  })

  it('shows a refusal in the error banner', async () => {
    const { fake, store } = await draw()
    const error = { code: 'RULE_VIOLATION' as const, message: 'Nothing to undo.' }
    fake.onCommand('history.undo', () => ({ ok: false, error }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(store.getState().error).toBe('Nothing to undo.'))
  })

  it('does not act on the key inside a text field', async () => {
    const { fake } = await draw()
    await userEvent.click(screen.getByRole('textbox', { name: 'A text field' }))
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(sentHistory(fake)).toEqual([])
  })

  it('does not act on the key while a variant tab is shown', async () => {
    const { fake } = await draw()
    act(() => nav?.getState().openVariant(P, 'C1', 'V2'))
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(sentHistory(fake)).toEqual([])
  })

  it('has no accessibility violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})
