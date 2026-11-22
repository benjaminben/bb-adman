// Places an open menu with placeMenu (R2-Q). It gives the props to spread on the menu element:
// data-inline and data-block, which the `placed` rule in menu-place.module.css reads, and a
// width held to the room on its side. The room is measured inside clipBox: the window, or the
// dialog body the button sits in. It measures before the first paint, and again, from the
// menu's own width, when the window resizes.
import { useLayoutEffect, useState, type RefObject } from 'react'
import { clipBox } from './clip-box'
import { placeMenu, type MenuPlace } from './menu-place'

type Measured = { round: number; place: MenuPlace }

export type MenuPlaceProps = {
  'data-inline'?: MenuPlace['inline']
  'data-block'?: MenuPlace['block']
  style?: { maxWidth: number }
}

export function useMenuPlace(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  menu: RefObject<HTMLElement | null>,
): MenuPlaceProps {
  // Each opening and each resize is a new round; a round's menu is first drawn unheld.
  const [round, setRound] = useState(0)
  const [measured, setMeasured] = useState<Measured | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const again = () => setRound((n) => n + 1)
    window.addEventListener('resize', again)
    return () => {
      window.removeEventListener('resize', again)
      again()
    }
  }, [open])

  useLayoutEffect(() => {
    const button = trigger.current
    const list = menu.current
    if (!open || !button || !list) return
    const margins = getComputedStyle(list)
    const gap = parseFloat(margins.marginTop) || parseFloat(margins.marginBottom) || 0
    const box = clipBox(button, { width: window.innerWidth, height: window.innerHeight })
    const at = button.getBoundingClientRect()
    // The button's edges and the room, both counted from the box's top left corner.
    const within = {
      left: at.left - box.left,
      top: at.top - box.top,
      right: at.right - box.left,
      bottom: at.bottom - box.top,
    }
    const room = { width: box.right - box.left, height: box.bottom - box.top }
    const size = list.getBoundingClientRect()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measure, then place before paint (react.dev useLayoutEffect)
    setMeasured({ round, place: placeMenu(within, size, room, gap) })
  }, [open, trigger, menu, round])

  const place = measured?.round === round ? measured.place : null
  if (!open || place === null) return {}
  return {
    'data-inline': place.inline,
    'data-block': place.block,
    style: { maxWidth: place.maxWidth },
  }
}
