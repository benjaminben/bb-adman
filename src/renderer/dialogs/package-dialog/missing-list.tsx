// The package dialog's missing files (DLG-6a): a warn mark "{n} missing", whose tip says why
// they matter, and each file as a row with the alert icon, named by its display name only.
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import styles from './package-dialog.module.css'

const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export function MissingList(props: { count: number; names: string[] }) {
  const why = `${plural(props.count, 'file')} cannot be found, so the package would not open with nothing missing.`
  return (
    <div className={styles.missing}>
      <StatusMark tone="warn" icon="alert" label={`${props.count} missing`} tip={why} />
      <ul aria-label="Missing files" className={layout.list}>
        {props.names.map((name, i) => (
          <li key={i}>
            <ObjectRow
              name={name}
              label={name}
              title={name}
              thumb={<Icon name="alert" />}
              mainProps={COVER}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
