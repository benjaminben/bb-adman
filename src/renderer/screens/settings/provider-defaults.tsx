// Default provider per AI job (FR-067). Providers not yet available are listed, disabled.
import { useApp, EMPTY } from '../../app/app-context'
import type { ProviderJob } from '../../../shared/schemas/queries'
import styles from '../screens.module.css'

const JOBS: Array<{
  job: Extract<ProviderJob, 'image' | 'layout' | 'text' | 'video'>
  label: string
}> = [
  { job: 'image', label: 'Image generation' },
  { job: 'layout', label: 'Layout' },
  { job: 'text', label: 'Text: briefs, copy and translation' },
  { job: 'video', label: 'Video generation' },
]

export function ProviderDefaults() {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const defaults = useApp((s) => s.app?.settings.defaultProviders)
  const command = useApp((s) => s.command)

  return (
    <div className={styles.card}>
      <h2>Default AI providers</h2>
      {JOBS.map(({ job, label }) => (
        <div key={job} className={styles.field}>
          <label htmlFor={`provider-${job}`}>{label}</label>
          <select
            id={`provider-${job}`}
            value={defaults?.[job] ?? ''}
            onChange={(e) =>
              void command('settings.update', { defaultProviders: { [job]: e.target.value } })
            }
          >
            {providers
              .filter((p) => p.jobs.includes(job))
              .map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.available ? p.label : `${p.label} (not yet available)`}
                </option>
              ))}
          </select>
        </div>
      ))}
    </div>
  )
}
