// R2E-10 (spec/phases/round-2-editor.md D8): the first Settings card, which opens the
// first-run setup at its welcome step whatever the mark says.
import { openSetup } from '@/renderer/app/first-run'
import layout from '@/renderer/ui/layout.module.css'

export function SetupSection() {
  return (
    <section className={layout.card} aria-labelledby="setup-title">
      <h2 id="setup-title">Setup</h2>
      <p className={layout.muted}>Walk through adding keys again.</p>
      <div className={layout.row}>
        <button type="button" onClick={openSetup}>
          Open the setup…
        </button>
      </div>
    </section>
  )
}
