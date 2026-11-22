// Default provider per AI job (FR-067), one inline row per job (SET-2). The control follows the
// number of providers for the job: one is plain text, two to four a Segmented group, five or
// more a select. Providers not yet available are listed, disabled, with the reason in the tip.
// Each control keeps the job's old name; a choice sends the same settings.update as before.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import type { ProviderInfo, ProviderJob } from '@/shared/schemas/queries/app'
import { Section } from '@/renderer/ui/section'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './provider-defaults.module.css'

type Job = Extract<ProviderJob, 'image' | 'layout' | 'text' | 'video'>

const JOBS: Array<{ job: Job; label: string; name: string }> = [
  { job: 'image', label: 'Image', name: 'Image generation' },
  { job: 'layout', label: 'Layout', name: 'Layout' },
  { job: 'text', label: 'Text', name: 'Text: briefs, copy and translation' },
  { job: 'video', label: 'Video', name: 'Video generation' },
]

const SOON = 'Not yet available'

function Choice(props: {
  name: string
  providers: ProviderInfo[]
  value: string
  onChoose: (id: string) => void
}) {
  const { name, providers, value, onChoose } = props
  if (providers.length === 1) {
    return (
      <div role="group" aria-label={name} className={styles.one}>
        {providers[0]!.label}
      </div>
    )
  }
  if (providers.length >= 5) {
    return (
      <select aria-label={name} value={value} onChange={(e) => onChoose(e.target.value)}>
        {providers.map((p) => (
          <option
            key={p.id}
            value={p.id}
            disabled={!p.available}
            title={p.available ? undefined : SOON}
          >
            {p.label}
          </option>
        ))}
      </select>
    )
  }
  return (
    <div role="group" aria-label={name} className={`${layout.seg} ${styles.seg}`}>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.id === value}
          disabled={!p.available}
          title={p.available ? undefined : SOON}
          onClick={() => p.id !== value && onChoose(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export function ProviderDefaults() {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const defaults = useApp((s) => s.app?.settings.defaultProviders)
  const command = useApp((s) => s.command)

  return (
    <Section id="settings.defaults" title="Defaults" level={3} fold="none">
      {JOBS.map(({ job, label, name }) => {
        const offered = providers.filter((p) => p.jobs.includes(job))
        if (offered.length === 0) return null
        return (
          <div key={job} className={`${layout.field} ${layout.inline}`}>
            <span className={styles.label}>
              {label}
              {job === 'text' && <InfoTip about="text">Briefs, copy and translation.</InfoTip>}
            </span>
            <Choice
              name={name}
              providers={offered}
              value={defaults?.[job] ?? ''}
              onChoose={(id) =>
                void command('settings.update', { defaultProviders: { [job]: id } })
              }
            />
          </div>
        )
      })}
    </Section>
  )
}
