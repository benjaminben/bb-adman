// R2E-10 (spec/phases/round-2-editor.md D8) and SET-1: the Setup button at the foot of the
// Settings side list. It opens the first-run setup at its welcome step whatever the mark says.
// The visible word is "Setup"; the name stays "Open the setup…" (the name rule).
import { openSetup } from '@/renderer/app/first-run'
import layout from '@/renderer/ui/layout.module.css'

export function SetupButton() {
  return (
    <button type="button" className={layout.quiet} aria-label="Open the setup…" onClick={openSetup}>
      Setup
    </button>
  )
}
