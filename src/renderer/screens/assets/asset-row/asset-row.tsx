// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, the groups' table): one file of
// the Assets panel. A small picture (or the kind's icon), the display name, its size or length,
// the marks, and for a picture the subject choice. A missing picture shows "File not found" in
// its place. Only the picked view reaches this row, so no path can be drawn.
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import styles from './asset-row.module.css'

export type AssetRowProps = {
  projectId: string
  asset: AssetView
  subjects: SubjectRow[]
  onSubject: (assetId: string, subjectId: string | null) => void
}

const ICONS: Record<AssetView['kind'], IconName> = {
  image: 'image',
  video: 'film',
  font: 'text',
  audio: 'file',
  text: 'file',
}

function length(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function assetDetail(asset: AssetView): string | null {
  if (asset.kind === 'font') return asset.fontFamily ? `Family: ${asset.fontFamily}` : null
  if (asset.kind !== 'image' && asset.kind !== 'video') return null
  const size = asset.width && asset.height ? `${asset.width}×${asset.height}` : null
  const time = asset.kind === 'video' && asset.durationMs !== null ? length(asset.durationMs) : null
  return [size, time].filter((part) => part !== null).join(' · ') || null
}

function marks(asset: AssetView): Array<{ words: string; look: string }> {
  const all = [
    { on: asset.library === 'reference', words: 'Reference only', look: layout.neutral },
    { on: asset.origin === 'generated', words: 'Made with AI', look: layout.info },
    { on: asset.storage === 'linked', words: 'Linked', look: layout.neutral },
    { on: asset.missing && asset.kind !== 'image', words: 'File not found', look: layout.warn },
  ]
  return all.filter((mark) => mark.on)
}

function Thumb({ projectId, asset }: { projectId: string; asset: AssetView }) {
  if (asset.kind !== 'image')
    return (
      <span className={styles.icon}>
        <Icon name={ICONS[asset.kind]} />
      </span>
    )
  if (asset.missing)
    return <span className={`${styles.thumb} ${styles.missing}`}>File not found</span>
  return <img className={styles.thumb} src={assetUrl(projectId, asset.id)} alt="" />
}

export function AssetRow({ projectId, asset, subjects, onSubject }: AssetRowProps) {
  const detail = assetDetail(asset)
  return (
    <li className={styles.row}>
      <Thumb projectId={projectId} asset={asset} />
      <div className={styles.text}>
        <span className={styles.name}>{asset.displayName}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        <span className={styles.marks}>
          {marks(asset).map((mark) => (
            <span key={mark.words} className={`${layout.badge} ${mark.look} ${styles.mark}`}>
              {mark.words}
            </span>
          ))}
        </span>
        {asset.kind === 'image' && (
          <label className={styles.subject}>
            Subject
            <select
              aria-label={`Subject of ${asset.displayName}`}
              value={asset.subjectId ?? ''}
              onChange={(e) => onSubject(asset.id, e.target.value === '' ? null : e.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </li>
  )
}
