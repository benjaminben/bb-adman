// The run dialog's "Provider" radio group (spec/screens-ai.md, "The run confirmation dialog"):
// every provider whose `jobs` holds the job. One not available is disabled with its words;
// ComfyUI is disabled when comfy.getInfo offers no workflow for the run, and an offered
// `trial` workflow shows the trial mark (spec/screens-campaign.md, "The trial mark in the
// panels"). For a cut-out ComfyUI is listed first (OI-55).
import { useId } from 'react'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { RunJob } from './run-summary'
import styles from './run-dialog.module.css'

export type Choice = {
  provider: ProviderInfo
  enabled: boolean
  label: string
  trial: boolean
  workflow?: WorkflowInfo
}

const COMFY = 'comfyui'

// The workflow job a ComfyUI run of this kind needs: pictures with a reference are
// `image_refs`. Layout and text have none.
function comfyJob(job: RunJob, referenceCount: number): string | null {
  if (job === 'image') return referenceCount > 0 ? 'image_refs' : 'image'
  return job === 'cutout' ? 'cutout' : null
}

function choiceFor(provider: ProviderInfo, wanted: string | null, info: ComfyInfo | null): Choice {
  const base = { provider, enabled: true, label: provider.label, trial: false }
  if (!provider.available) {
    return { ...base, enabled: false, label: `${provider.label} (not yet available)` }
  }
  if (provider.id !== COMFY) return base
  // Before comfy.getInfo answers, no workflow is known.
  const workflow = info?.workflows.find((w) => w.offered && w.job === wanted)
  if (!workflow) return { ...base, enabled: false, label: 'ComfyUI (no workflow for this yet)' }
  return { ...base, trial: workflow.status === 'trial', workflow }
}

export function runChoices(
  job: RunJob,
  providers: ProviderInfo[],
  info: ComfyInfo | null,
  referenceCount: number,
): Choice[] {
  const listed = providers.filter((p) => p.jobs.includes(job))
  if (job === 'cutout') listed.sort((a, b) => Number(b.id === COMFY) - Number(a.id === COMFY))
  const wanted = comfyJob(job, referenceCount)
  return listed.map((p) => choiceFor(p, wanted, info))
}

// The saved default for the job when it is enabled, else the first enabled choice.
export function startChoice(choices: Choice[], preferred: string | undefined): string | null {
  const enabled = choices.filter((c) => c.enabled)
  const saved = enabled.find((c) => c.provider.id === preferred)
  return (saved ?? enabled[0])?.provider.id ?? null
}

export function ProviderChoice(props: {
  choices: Choice[]
  value: string | null
  onChange: (id: string) => void
  disabled: boolean
}) {
  const name = useId()
  const markId = useId()
  return (
    <fieldset className={styles.choices} disabled={props.disabled}>
      <legend>Provider</legend>
      {props.choices.map((c) => (
        <div key={c.provider.id} className={styles.choice}>
          <input
            type="radio"
            id={`${name}-${c.provider.id}`}
            name={name}
            value={c.provider.id}
            checked={props.value === c.provider.id}
            disabled={!c.enabled}
            aria-describedby={c.trial ? markId : undefined}
            onChange={() => props.onChange(c.provider.id)}
          />
          <label htmlFor={`${name}-${c.provider.id}`}>{c.label}</label>
          {c.trial && (
            <span id={markId} className={styles.muted}>
              (trial)
            </span>
          )}
        </div>
      ))}
    </fieldset>
  )
}
