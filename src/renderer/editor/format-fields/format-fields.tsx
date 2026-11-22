// P7-17 (spec/phases/phase-07-slices-2.md): in the editor's top bar, the radio group "Format"
// ("Image", "Video") sends variant.setFormat, and a video's "Length (seconds)" sends
// variant.update { durationMs }. The controls always show the stored values: a change shows once
// project.changed brings it. A refusal shows its own sentence under the controls.
import { useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { LengthField } from './length-field'
import styles from './format-fields.module.css'

type Format = VariantRow['format']

export type FormatFieldsProps = {
  projectId: string
  variant: Pick<VariantRow, 'id' | 'format' | 'durationMs'>
}

const CHOICES: Array<{ value: Format; label: string }> = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
]

export function FormatFields({ projectId, variant }: FormatFieldsProps) {
  const api = useApi()
  const id = useId()
  const [error, setError] = useState<string | null>(null)

  async function send(name: string, input: Record<string, unknown>): Promise<boolean> {
    const result = await api.command(name, { projectId, variantId: variant.id, ...input })
    setError(result.ok ? null : result.error.message)
    return result.ok
  }

  return (
    <div className={styles.fields}>
      <div className={styles.controls}>
        <div role="radiogroup" aria-labelledby={`${id}-format`} className={styles.group}>
          <span id={`${id}-format`} className={styles.label}>
            Format
          </span>
          {CHOICES.map((choice) => (
            <label key={choice.value} className={styles.choice}>
              <input
                type="radio"
                name={`${id}-format`}
                value={choice.value}
                checked={variant.format === choice.value}
                onChange={() => void send('variant.setFormat', { format: choice.value })}
              />
              {choice.label}
            </label>
          ))}
        </div>
        {variant.format === 'video' && (
          <LengthField
            durationMs={variant.durationMs}
            onCommit={(durationMs) => send('variant.update', { durationMs })}
          />
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
