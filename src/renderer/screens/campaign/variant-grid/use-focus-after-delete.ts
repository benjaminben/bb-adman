// P5-15 (spec/screens-variants.md, "The tile's actions"): when a variant asked for deletion
// leaves the list while focus has nowhere to be, focus goes to the next tile's main button,
// else the previous one, else the direction's heading.
import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

type Pending = { id: string; neighbours: string[] }

function focusHeading(from: HTMLElement | null) {
  const heading = from?.closest('section')?.querySelector<HTMLElement>('h2, h3')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus()
}

export function useFocusAfterDelete(
  variants: VariantSummary[],
  root: RefObject<HTMLElement | null>,
) {
  const pending = useRef<Pending | null>(null)
  useLayoutEffect(() => {
    const asked = pending.current
    if (!asked || variants.some((v) => v.id === asked.id)) return
    pending.current = null
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const target = asked.neighbours.find((id) => variants.some((v) => v.id === id))
    const button = root.current?.querySelector<HTMLElement>(
      `[data-variant="${CSS.escape(target ?? '')}"] button`,
    )
    if (target && button) button.focus()
    else focusHeading(root.current)
  }, [variants, root])
  return (id: string) => {
    const i = variants.findIndex((v) => v.id === id)
    const neighbours = [variants[i + 1]?.id, variants[i - 1]?.id].filter((n) => n !== undefined)
    pending.current = { id, neighbours }
  }
}
