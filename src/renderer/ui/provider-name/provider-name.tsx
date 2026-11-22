// R3-2: a provider's name with the model of the job on a second, muted line under it, for a
// narrow picker. The two lines read as one "{provider} · {model}" (shared/providers/model-
// words.ts): the dot is in the text, unseen, so the accessible name matches the one-line words.
// No model: the plain label alone. The model is on the page, never only in a tooltip.
import { providerModelParts } from '@/shared/providers/model-words'
import styles from './provider-name.module.css'

export function ProviderName(props: { label: string; model: string | null }) {
  const parts = providerModelParts(props.label, props.model)
  if (parts.model === null) return <>{parts.provider}</>
  const both = parts.provider !== ''
  return (
    <span className={styles.name}>
      {both && <span>{parts.provider}</span>}
      <span className={styles.model}>
        {both && <span className={styles.hidden}> · </span>}
        {parts.model}
      </span>
    </span>
  )
}
