// Design wave CAMP-1: the sign-off list in a popover, opened from a tile's "Signed off by {n}"
// mark. It has the menu look and is fixed in the window, so the grid's sideways scroll box never
// cuts it; placeMenu keeps it inside the window. Escape closes it and
// gives focus back to the mark; a press outside closes it. Emails show here only, as text.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ApprovalsSignoff } from '@/shared/schemas/queries/approvals'
import layout from '@/renderer/ui/layout.module.css'
import { placeMenu } from '@/renderer/ui/menu-place'
import { SignoffList } from './signoff-list'
import styles from './signoff-list.module.css'

export type SignoffPopoverProps = {
  anchor: HTMLElement | null
  label: string
  signoffs: ApprovalsSignoff[]
  onClose: () => void
}

function placeAt(anchor: HTMLElement, box: HTMLElement): CSSProperties {
  const edge = anchor.getBoundingClientRect()
  const size = box.getBoundingClientRect()
  const gap = parseFloat(getComputedStyle(box).getPropertyValue('--space-1')) || 0
  const view = { width: window.innerWidth, height: window.innerHeight }
  const place = placeMenu(edge, size, view, gap)
  return {
    left: place.inline === 'start' ? edge.left : edge.right - size.width,
    top: place.block === 'below' ? edge.bottom + gap : edge.top - gap - size.height,
  }
}

export function SignoffPopover(props: SignoffPopoverProps) {
  const box = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})
  const [round, setRound] = useState(0)
  const { anchor, onClose } = props

  useLayoutEffect(() => {
    if (!anchor || !box.current) return
    // Measure, then place before paint (react.dev useLayoutEffect).
    setStyle(placeAt(anchor, box.current))
  }, [anchor, round])

  useEffect(() => {
    const again = () => setRound((n) => n + 1)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
      anchor?.focus()
    }
    const onDown = (event: MouseEvent) => {
      const inside = [box.current, anchor].some(
        (el) => event.target instanceof Node && el?.contains(event.target),
      )
      if (!inside) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', again)
    window.addEventListener('scroll', again, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', again)
      window.removeEventListener('scroll', again, true)
    }
  }, [anchor, onClose])

  return (
    <div ref={box} className={`${layout.menu} ${styles.popover}`} style={style}>
      <SignoffList label={props.label} signoffs={props.signoffs} />
    </div>
  )
}
