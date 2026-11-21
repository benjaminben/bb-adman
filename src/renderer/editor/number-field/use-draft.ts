// spec/editor.md, "Properties panel": the text a field shows while the user edits it. It saves
// once, when asked (Enter or leaving the field), and never sends the same value twice. A refused
// value keeps the command's message and the field goes back to the stored value. A new stored
// value (from project.changed) replaces the text.
import { useState } from 'react'

// Resolves to the refusal message, or null when the value was saved.
export type Commit = (text: string) => Promise<string | null>

export function useDraft(stored: string, commit: Commit) {
  const [base, setBase] = useState(stored)
  const [text, setText] = useState(stored)
  const [sent, setSent] = useState(stored)
  const [error, setError] = useState<string | null>(null)
  if (base !== stored) {
    setBase(stored)
    setText(stored)
    setSent(stored)
  }

  function reset() {
    setText(stored)
    setSent(stored)
  }

  async function save(value: string = text) {
    setText(value)
    if (value === sent) return
    setSent(value)
    const refused = await commit(value)
    setError(refused)
    if (refused !== null) reset()
  }

  return { text, setText, error, save, reset }
}
