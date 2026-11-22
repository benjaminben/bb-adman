// Design wave CAMP-1: the tile's "Running" mark opens the Activity panel through the window's
// activity store, as the top bar's button does; it starts nothing. Drawn without that scope
// (its own tests), the mark stays plain. The scope is there or not for the grid's whole life,
// so the hooks called stay the same on every render (as use-shown-running.ts).
import { useActivity } from '@/renderer/app/activity-panel'

export function useOpenActivity(): (() => void) | undefined {
  try {
    const setOpen = useActivity((s) => s.setOpen)
    return () => setOpen(true)
  } catch {
    return undefined
  }
}
