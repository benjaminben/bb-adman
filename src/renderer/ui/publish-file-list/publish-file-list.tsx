// "Files that will be uploaded" in the publish dialog (DLG-6b; spec/phases/phase-09.md
// "Screens"; R-06): every file that will leave this computer, one ObjectRow each with its
// thumbnail, display name and kind, in the published folders' order. Under each row its full
// local path stays as plain text, whole (A-218): a project file from someone else can point an
// asset at any file on this computer, so the path is the user's check of what will leave it.
// The path is in no tooltip, name or attribute; the thumbnail is drawn through the asset
// address, which holds only the project and asset IDs. A file that will be skipped, and a font
// without consent given on this computer (A-260), keep a visible mark with their words.
import { Icon, type IconName } from '@/renderer/ui/icon'
import { assetUrl } from '@/renderer/ui/asset-url'
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark, type StatusTone } from '@/renderer/ui/status-mark'
import { displayName, displayPath } from '@/shared/publish/display-text'
import type {
  PublishComponentFolder,
  PublishInspectComponent,
} from '@/shared/schemas/queries/publish'
import styles from './publish-file-list.module.css'

export type PublishFileListProps = { projectId: string; components: PublishInspectComponent[] }

// The order of the published folders (the order publish.inspect sorts by).
const FOLDERS: PublishComponentFolder[] = ['logos', 'subjects', 'fonts', 'backgrounds', 'images']

const KINDS: Record<PublishInspectComponent['kind'], { word: string; icon: IconName }> = {
  image: { word: 'Picture', icon: 'image' },
  video: { word: 'Video', icon: 'film' },
  font: { word: 'Font', icon: 'text' },
}

type Mark = { tone: StatusTone; label: string; tip: string }

function markOf(c: PublishInspectComponent): Mark | null {
  if (c.problem === 'missing')
    return { tone: 'danger', label: 'File not found', tip: 'File not found, will be skipped' }
  if (c.problem === 'wrong_type')
    return { tone: 'danger', label: 'Not usable', tip: 'Not a usable file, will be skipped' }
  if (c.kind === 'font' && c.share !== 'confirmed')
    return { tone: 'warn', label: 'Not uploaded', tip: 'Will not be uploaded' }
  return null
}

// The row's main button only covers it; the rows hold no action.
const COVER = { tabIndex: -1, 'aria-hidden': true } as const

function FileRow(props: { projectId: string; file: PublishInspectComponent }) {
  const { file } = props
  const name = displayName(file.displayName)
  const kind = KINDS[file.kind]
  const mark = markOf(file)
  const picture = file.kind === 'image' && file.problem === null
  return (
    <ObjectRow
      name={<bdi>{name}</bdi>}
      label={[name, kind.word, mark?.tip].filter(Boolean).join(' · ')}
      meta={kind.word}
      muted={file.problem !== null}
      thumb={
        picture ? (
          <img src={assetUrl(props.projectId, file.assetId)} alt="" />
        ) : (
          <Icon name={kind.icon} />
        )
      }
      marks={mark && <StatusMark tone={mark.tone} icon="alert" label={mark.label} tip={mark.tip} />}
      mainProps={COVER}
    />
  )
}

export function PublishFileList(props: PublishFileListProps) {
  const files = FOLDERS.flatMap((folder) => props.components.filter((c) => c.folder === folder))
  return (
    <section aria-label="Files that will be uploaded" className={styles.list}>
      <h3 className={styles.heading}>Files that will be uploaded</h3>
      {files.length === 0 ? (
        <p className={layout.muted}>No pictures, videos or fonts are used.</p>
      ) : (
        <ul aria-label="Files" className={layout.list}>
          {files.map((c) => (
            <li key={c.assetId}>
              <FileRow projectId={props.projectId} file={c} />
              <span className={`${layout.path} ${styles.path}`}>{displayPath(c.localPath)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
