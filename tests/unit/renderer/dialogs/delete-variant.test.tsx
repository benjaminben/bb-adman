// spec/screens-variants.md, "The tile's actions" [D-099]: "Delete {title}?" with "This cannot
// be undone."; "Keep" has focus and sends nothing; "Delete variant" sends variant.delete; a
// refusal shows in the dialog and the banner; after the delete the tile is gone and the
// campaign's Undo is not offered for it (phase 5 exit criterion 4, with stubbed replies).
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../shared/scene/fake-fonts'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { axeViolations } from '../render'
import {
  MASTER,
  P,
  SECOND,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
} from '../screens/campaign/campaign-fixture'
import { twoDirections } from './tile-actions-fixture'

async function draw() {
  return renderWith(
    <main>
      <h1>Campaign</h1>
      <DirectionGrids
        projectId={P}
        campaign={twoDirections()}
        chosenId="V1"
        onChoose={() => {}}
        onOpenBehind={() => {}}
      />
    </main>,
  )
}

async function openDelete(title = 'German post') {
  await userEvent.click(screen.getByRole('button', { name: `Delete ${title}` }))
  return screen.getByRole('dialog', { name: `Delete ${title}?` })
}

describe('Delete variant [D-099]', () => {
  it('asks "Delete {title}?" with "This cannot be undone.", and "Keep" has focus', async () => {
    await draw()
    const dialog = await openDelete()
    expect(within(dialog).getByText('This cannot be undone.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Delete variant' })).toBeInTheDocument()
  })

  it('"Keep" closes and sends nothing', async () => {
    const { fake } = await draw()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'variant.delete')).toEqual([])
  })

  it('"Delete variant" sends variant.delete for the variant and closes', async () => {
    const { fake } = await draw()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete variant' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'variant.delete').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V2' },
    ])
  })

  it('shows a refusal in the dialog and in the banner', async () => {
    const { fake, store } = await draw()
    const message = 'Work is still running for this variant. Stop it, or wait for it to finish.'
    fake.onCommand('variant.delete', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'jobs_running' } },
    }))
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete variant' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(store.getState().error).toBe(message)
  })

  it('has no accessibility violations', async () => {
    await draw()
    await openDelete()
    expect(await axeViolations()).toEqual([])
  })
})

describe('Delete variant on the campaign page [D-099, exit criterion 4]', () => {
  it("removes the tile, and the campaign's Undo is not offered for it", async () => {
    const fake = campaignApi()
    let deleted = false
    fake.onQuery('campaign.get', () => ({
      ok: true,
      data: campaignGet(deleted ? [MASTER] : [MASTER, SECOND]),
    }))
    // Stubbed as variant.delete leaves it: no entry on the campaign's list (D-099).
    fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
    fake.onCommand('variant.delete', () => {
      deleted = true
      return { ok: true, data: { variantId: 'V2' } }
    })
    await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete German post' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete German post?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete variant' }))
    act(() =>
      fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' }),
    )
    const grid = screen.getByRole('list', { name: 'Variants in Main' })
    await waitFor(() => expect(within(grid).getAllByRole('listitem')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: /^German post/ })).toBeNull()
    expect(fake.queries.filter((q) => q.name === 'history.state')).toHaveLength(2)
    const changes = screen.getByRole('group', { name: 'Campaign changes' })
    expect(within(changes).getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(sent(fake, 'history.undo')).toEqual([])
  })
})
