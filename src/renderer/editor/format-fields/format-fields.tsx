// P7-17 (spec/phases/phase-07-slices-2.md), drawn as ED-5 says: in the editor's top bar, the
// group "Format" holds two icon segments, "Image" and "Video" (aria-pressed), that send
// variant.setFormat; a click on the chosen one sends nothing, as the radios did. A video's
// "Length (seconds)" sends variant.update { durationMs }. The controls always show the stored
// values: a change shows once project.changed brings it. A refusal shows its own sentence under
// the controls, in words.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { LengthField } from './length-field'
import styles from './format-fields.module.css'

type Format = VariantRow['format']

export type FormatFieldsProps = {
  projectId: string
  variant: Pick<VariantRow, 'id' | 'format' | 'durationMs'>
}

const CHOICES: Array<{ value: Format; label: string; icon: IconName }> = [
  { value: 'image', label: 'Image', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'film' },
]

export function FormatFields({ projectId, variant }: FormatFieldsProps) {
  const api = useApi()
  const [error, setError] = useState<string | null>(null)

  async function send(name: string, input: Record<string, unknown>): Promise<boolean> {
    const result = await api.command(name, { projectId, variantId: variant.id, ...input })
    setError(result.ok ? null : result.error.message)
    return result.ok
  }

  function choose(format: Format) {
    if (format !== variant.format) void send('variant.setFormat', { format })
  }

  return (
    <div className={styles.fields}>
      <div className={styles.controls}>
        <div role="group" aria-label="Format" className={layout.seg}>
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={layout.iconButton}
              aria-label={choice.label}
              title={choice.label}
              aria-pressed={variant.format === choice.value}
              onClick={() => choose(choice.value)}
            >
              <Icon name={choice.icon} />
            </button>
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
