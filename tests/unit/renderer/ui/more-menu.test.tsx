// T3c (spec/app-style-parts.md, "ObjectRow", MoreMenu): the ⋯ button of a row and its menu.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoreMenu, type MoreItem } from '@/renderer/ui/more-menu'
import { axeViolations } from '../render'

function items(): MoreItem[] {
  return [
    { id: 'delete', label: 'Delete', danger: true, onChoose: vi.fn() },
    { id: 'rename', label: 'Rename…', icon: 'pencil', onChoose: vi.fn() },
    { id: 'remove', label: 'Remove from list', danger: true, onChoose: vi.fn() },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: 'copy',
      disabled: true,
      reason: 'Unlock the layer first',
      onChoose: vi.fn(),
    },
  ]
}

function draw(list = items()) {
  render(
    <main>
      <MoreMenu label="Summer sale" items={list} />
      <button type="button">Elsewhere</button>
    </main>,
  )
  return list
}

const trigger = () => screen.getByRole('button', { name: 'More actions for Summer sale' })

async function open() {
  await userEvent.click(trigger())
  return screen.getByRole('menu')
}

describe('MoreMenu [T3c]', () => {
  it('is an icon button "More actions for {name}" that says it opens a menu', () => {
    draw()
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveAttribute('title', 'More actions for Summer sale')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens with the items in the given order, danger items last after a separator', async () => {
    draw()
    const menu = await open()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((el) => el.textContent)
    expect(names).toEqual(['Rename…', 'Duplicate', 'Delete', 'Remove from list'])
    const order = [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
      (el) => el.getAttribute('role') === 'separator' || el.textContent,
    )
    expect(order).toEqual(['Rename…', 'Duplicate', true, 'Delete', 'Remove from list'])
  })

  it('draws no separator when there is no danger item', async () => {
    draw(items().filter((i) => !i.danger))
    const menu = await open()
    expect(within(menu).queryByRole('separator')).toBeNull()
  })

  it('moves with the arrow keys, wrapping', async () => {
    draw()
    await open()
    const [rename, duplicate, , remove] = screen.getAllByRole('menuitem')
    expect(rename).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(duplicate).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(remove).toHaveFocus()
  })

  it('closes on Escape and gives focus back to the button', async () => {
    draw()
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  it('closes on a click outside', async () => {
    draw()
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('calls onChoose on click and on Enter, then closes', async () => {
    const list = draw()
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename…' }))
    expect(list[1]?.onChoose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    await open()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(list[0]?.onChoose).toHaveBeenCalledTimes(1)
  })

  it('never fires an item on open or on hover', async () => {
    const list = draw()
    trigger().focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.hover(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard(' ')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    for (const item of list) expect(item.onChoose).not.toHaveBeenCalled()
  })

  it('gives a disabled item its reason in title and never calls it', async () => {
    const list = draw()
    await open()
    const duplicate = screen.getByRole('menuitem', { name: 'Duplicate' })
    expect(duplicate).toHaveAttribute('aria-disabled', 'true')
    expect(duplicate).toHaveAttribute('title', 'Unlock the layer first')
    await userEvent.click(duplicate)
    duplicate.focus()
    await userEvent.keyboard('{Enter}')
    expect(list[3]?.onChoose).not.toHaveBeenCalled()
  })

  it('passes axe open', async () => {
    draw()
    await open()
    expect(await axeViolations()).toEqual([])
  })
})
