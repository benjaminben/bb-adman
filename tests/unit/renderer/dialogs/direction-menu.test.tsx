// spec/screens-variants.md, "Direction dialogs": a menu button "Direction" with three items.
// "New direction from this master…" opens "New direction" (Name defaults to the next free
// "Direction {n}") and sends direction.createFromMaster; "Rename…" opens "Rename {name}" and
// sends direction.rename; "Delete direction…" opens "Delete {name}?" with the variant count and
// "This cannot be undone." [D-099], "Keep" focused, and sends direction.delete. With one
// direction, "Delete direction…" is disabled with its hint. A refusal shows in the dialog.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DirectionMenu } from '@/renderer/dialogs/direction-menu'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../render'
import {
  MASTER,
  P,
  SECOND,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
  variant,
} from '../screens/campaign/campaign-fixture'

const STUDIO = { id: 'D2', campaignId: 'C1', name: 'Studio', masterVariantId: 'V3', sort: 1 }

function twoDirections(): CampaignGet {
  const base = campaignGet([MASTER, SECOND, variant('V3', { directionId: 'D2', isMaster: true })])
  return { ...base, directions: [{ ...base.directions[0]!, name: 'Direction 1' }, STUDIO] }
}

async function draw(campaign = twoDirections()) {
  const fake = campaignApi()
  const view = await renderWith(
    <main>
      <h1>Project</h1>
      <DirectionMenu projectId={P} campaign={campaign} direction={campaign.directions[0]!} />
    </main>,
    fake,
  )
  return view
}

const menuButton = () => screen.getByRole('button', { name: 'Direction' })

async function choose(item: string) {
  await userEvent.click(menuButton())
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

describe('DirectionMenu', () => {
  it('shows the three items, moves with the arrow keys and closes on Escape', async () => {
    await draw()
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(menuButton())
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent)
    expect(items).toEqual(['New direction from this master…', 'Rename…', 'Delete direction…'])
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Delete direction…' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(menuButton()).toHaveFocus()
  })

  it('makes a new direction from this master with the next free name', async () => {
    const { fake } = await draw()
    await choose('New direction from this master…')
    const dialog = screen.getByRole('dialog', { name: 'New direction' })
    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(dialog).toContainElement(name)
    expect(name).toHaveValue('Direction 3')
    await userEvent.clear(name)
    await userEvent.type(name, 'Night')
    await userEvent.click(screen.getByRole('button', { name: 'Make direction' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'direction.createFromMaster').map((c) => c.input)).toEqual([
      { projectId: P, masterVariantId: 'V1', name: 'Night' },
    ])
    expect(menuButton()).toHaveFocus()
  })

  it('renames the direction', async () => {
    const { fake } = await draw()
    await choose('Rename…')
    screen.getByRole('dialog', { name: 'Rename Direction 1' })
    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toHaveValue('Direction 1')
    await userEvent.clear(name)
    await userEvent.type(name, 'Morning{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'direction.rename').map((c) => c.input)).toEqual([
      { projectId: P, directionId: 'D1', name: 'Morning' },
    ])
  })

  it('shows a direction_name_taken refusal in the dialog and the banner, and stays open', async () => {
    const { fake, store } = await draw()
    const message = 'This campaign already has a direction with that name.'
    fake.onCommand('direction.rename', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'direction_name_taken' } },
    }))
    await choose('Rename…')
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Studio')
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const dialog = screen.getByRole('dialog', { name: 'Rename Direction 1' })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
    expect(dialog).toContainElement(screen.getByRole('alert'))
    expect(store.getState().error).toBe(message)
  })

  it('warns before delete with the count, "Keep" focused and sending nothing', async () => {
    const { fake } = await draw()
    await choose('Delete direction…')
    const dialog = screen.getByRole('dialog', { name: 'Delete Direction 1?' })
    expect(dialog).toHaveTextContent('Its 2 variant(s) go with it. This cannot be undone.')
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'direction.delete')).toEqual([])
  })

  it('sends direction.delete on "Delete direction"', async () => {
    const { fake } = await draw()
    await choose('Delete direction…')
    await userEvent.click(screen.getByRole('button', { name: 'Delete direction' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'direction.delete').map((c) => c.input)).toEqual([
      { projectId: P, directionId: 'D1' },
    ])
  })

  it('disables "Delete direction…" with its hint for the only direction', async () => {
    const { fake } = await draw(campaignGet([MASTER, SECOND]))
    await userEvent.click(menuButton())
    const item = screen.getByRole('menuitem', { name: 'Delete direction…' })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveAccessibleDescription('A campaign keeps at least one direction.')
    await userEvent.click(item)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'direction.delete')).toEqual([])
  })

  it('has no accessibility violations, closed, open and in a dialog', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
    await userEvent.click(menuButton())
    expect(await axeViolations()).toEqual([])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename…' }))
    expect(await axeViolations()).toEqual([])
  })
})
