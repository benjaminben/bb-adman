// Default provider per AI job (FR-067), one inline row per job (SET-2). The control follows the
// number of providers for the job: one is plain text, two to four a Segmented group, five or
// more a select. Providers not yet available are listed, disabled, with the reason in the tip.
// Each control keeps the job's old name; a choice sends the same settings.update as before.
// R3-2: each provider names the model it runs for the job on a second, muted line (ComfyUI's
// from the workflow comfy.getInfo offers for the job); a select's option names both on one.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'
import { ProviderName } from '@/renderer/ui/provider-name'
import { jobModel, providerModelWords, workflowModel } from '@/shared/providers/model-words'
import type { ProviderInfo, ProviderJob } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
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

// The model each provider runs for the job; ComfyUI's from its offered workflow.
function modelsFor(job: Job, providers: ProviderInfo[], info: ComfyInfo | null) {
  const comfy = workflowModel(job === 'image' || job === 'video' ? offeredFor(info, job) : null)
  return new Map(providers.map((p) => [p.id, jobModel(p, job, comfy)]))
}

function Choice(props: {
  name: string
  providers: ProviderInfo[]
  models: Map<string, string | null>
  value: string
  onChoose: (id: string) => void
}) {
  const { name, providers, value, onChoose } = props
  const model = (p: ProviderInfo) => props.models.get(p.id) ?? null
  if (providers.length === 1) {
    const only = providers[0]!
    return (
      <div role="group" aria-label={name} className={styles.one}>
        <ProviderName label={only.label} model={model(only)} />
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
            {providerModelWords(p.label, model(p))}
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
          aria-label={providerModelWords(p.label, model(p))}
          onClick={() => p.id !== value && onChoose(p.id)}
        >
          <ProviderName label={p.label} model={model(p)} />
        </button>
      ))}
    </div>
  )
}

export function ProviderDefaults() {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const defaults = useApp((s) => s.app?.settings.defaultProviders)
  const command = useApp((s) => s.command)
  const info = useComfyInfo()

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
              models={modelsFor(job, offered, info)}
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
