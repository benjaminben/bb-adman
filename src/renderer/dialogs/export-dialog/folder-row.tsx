// The export dialog's folder (DLG-6a; spec/phases/phase-08.md "The output folder"): one row
// with the folder's base name, cut in the middle when long, and "Change…" ("Choose folder…"
// before one is chosen). The folder comes only from the system picker, never typed. The full
// path is the row's `title` and nowhere else: not its name, not any other attribute. Under the
// row, the replace sentence stays as visible words (lost work; A-193).
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { middleCut } from '@/renderer/ui/middle-cut'
import { ObjectRow } from '@/renderer/ui/object-row'
import { OVERWRITE_NOTE } from '@/shared/export/messages'
import styles from './export-dialog.module.css'

export type FolderRowProps = {
  folder: string | null
  disabled: boolean
  onChooseFolder: () => void
}

const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export function baseName(path: string): string {
  const parts = path.split(/[/\\]/).filter((part) => part !== '')
  return parts[parts.length - 1] ?? path
}

export function FolderRow(props: FolderRowProps) {
  const { folder } = props
  const name = folder === null ? 'No folder chosen' : middleCut(baseName(folder))
  return (
    <div className={styles.group}>
      <ObjectRow
        name={name}
        label={folder === null ? name : `Folder ${name}`}
        title={folder ?? undefined}
        muted={folder === null}
        thumb={<Icon name="folder" />}
        mainProps={COVER}
        stateActions={
          <button
            type="button"
            className={`${layout.secondary} ${layout.small}`}
            disabled={props.disabled}
            onClick={props.onChooseFolder}
          >
            {folder === null ? 'Choose folder…' : 'Change…'}
          </button>
        }
      />
      <p className={styles.note}>
        <Icon name="alert" size="small" />
        <span>{OVERWRITE_NOTE}</span>
      </p>
    </div>
  )
}
