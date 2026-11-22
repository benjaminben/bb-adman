// One Copy control's state (SPEC 14 1.59 L-20; SET-5): the text is handed to the renderer's
// clipboard on a click only. The result is kept for the text it was tried with, so a new token's
// line starts again at "Copy". A failed copy logs nothing.
import { useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

export function useCopy(text: string): [CopyState, () => Promise<void>] {
  const [tried, setTried] = useState<{ text: string; ok: boolean } | null>(null)
  const state: CopyState =
    tried === null || tried.text !== text ? 'idle' : tried.ok ? 'copied' : 'failed'

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setTried({ text, ok: true })
    } catch {
      setTried({ text, ok: false })
    }
  }

  return [state, copy]
}
