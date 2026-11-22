// Where a menu opens so it stays fully inside the window (R2-Q). It starts at its button's left
// edge, below the button. Without room to the right it lines its right edge up with the
// button's right edge; without room below it opens above. When neither side has room it takes
// the side with more, and it is never wider than the room on its side. Pure.
export type Edges = { left: number; top: number; right: number; bottom: number }
export type Size = { width: number; height: number }
export type MenuPlace = { inline: 'start' | 'end'; block: 'below' | 'above'; maxWidth: number }

export function placeMenu(trigger: Edges, menu: Size, view: Size, gap: number): MenuPlace {
  const roomRight = view.width - trigger.left
  const roomLeft = trigger.right
  const inline =
    menu.width <= roomRight || (menu.width > roomLeft && roomRight >= roomLeft) ? 'start' : 'end'
  const roomBelow = view.height - trigger.bottom - gap
  const roomAbove = trigger.top - gap
  const block =
    menu.height <= roomBelow || (menu.height > roomAbove && roomBelow >= roomAbove)
      ? 'below'
      : 'above'
  return { inline, block, maxWidth: inline === 'start' ? roomRight : roomLeft }
}
