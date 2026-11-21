// Keys for the AI providers (FR-170, R-10). Storage sign-in arrives with Phase 9.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { KeyRow } from '@/renderer/screens/settings/key-row'
import layout from '@/renderer/ui/layout.module.css'

export function KeysSection() {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const aiProviders = providers.filter((p) => p.secrets.length > 0 && !p.jobs.includes('storage'))

  return (
    <div className={layout.card}>
      <h2>Keys</h2>
      <p className={layout.muted}>
        Keys are stored encrypted on this computer. After saving, only the last four characters are
        shown.
      </p>
      {aiProviders.map((p) =>
        p.available ? (
          p.secrets.map((name) => <KeyRow key={name} provider={p} name={name} />)
        ) : (
          <fieldset key={p.id} className={layout.keyRow}>
            <legend>{p.label}</legend>
            <span className={layout.muted}>Not yet available</span>
          </fieldset>
        ),
      )}
    </div>
  )
}
