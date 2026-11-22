// A square Copy button for one value of the Connect Section (SET-5): "Copy address", "Copy
// token". Its name and tooltip are the fixed label, then "Copied"; never the value itself.
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { CopyState } from './use-copy'

export function CopyIcon(props: { label: string; state: CopyState; onCopy: () => void }) {
  const name = props.state === 'copied' ? 'Copied' : props.label
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={name}
      title={name}
      onClick={props.onCopy}
    >
      <Icon name={props.state === 'copied' ? 'check' : 'copy'} />
    </button>
  )
}
