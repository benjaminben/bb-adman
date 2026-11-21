// The master's slots (spec/screens-campaign.md, "The slot view") [FR-042]: one row per slot in
// template order, filled or empty, and for an empty picture slot the pictures that could go
// there. View only (A-46): choosing a candidate comes with the Phase 3 picture chooser.
import type { TemplateSlots } from '@/shared/schemas/queries/campaign'
import { assetUrl } from '@/renderer/ui/asset-url'
import layout from '@/renderer/ui/layout.module.css'
import { type Candidate, type SlotsRead, useSlots, wantsPictures } from './use-slots'
import styles from './slot-view.module.css'

export type SlotViewProps = { projectId: string; campaignId: string }

const HEADING = 'Slots of the master'

const NAMES: Record<string, string> = {
  background: 'Background',
  'subject-image': 'Subject picture',
  logo: 'Logo',
  headline: 'Headline',
  'call-to-action': 'Call to action',
}

function Candidates(props: { projectId: string; list: Candidate[] }) {
  return (
    <div className={layout.field}>
      <p className={styles.line}>Pictures that could go here:</p>
      <ul className={layout.list}>
        {props.list.map((asset) => (
          <li key={asset.id} className={layout.row}>
            {asset.missing ? (
              <span className={styles.missing}>file not found</span>
            ) : (
              <img
                className={styles.thumb}
                src={assetUrl(props.projectId, asset.id)}
                alt={asset.displayName}
              />
            )}
            {/* With a picture, its alt already says the name, so the text is not read twice. */}
            <span aria-hidden={!asset.missing || undefined}>{asset.displayName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Rows(props: { projectId: string; read: Extract<SlotsRead, { kind: 'done' }> }) {
  const { slots, assets } = props.read
  const candidatesOf = (entry: TemplateSlots[number]): Candidate[] =>
    wantsPictures(entry) ? entry.candidates.flatMap((id) => assets.get(id) ?? []) : []
  return (
    <ul className={layout.list} aria-label={HEADING}>
      {slots.map((entry) => {
        const list = candidatesOf(entry)
        return (
          <li key={entry.slot.id} className={styles.slot}>
            <span>
              <span className={layout.label}>{NAMES[entry.slot.id] ?? entry.slot.id}</span>{' '}
              <span className={layout.muted}>{entry.state === 'filled' ? 'Filled' : 'Empty'}</span>
            </span>
            {list.length > 0 && <Candidates projectId={props.projectId} list={list} />}
          </li>
        )
      })}
    </ul>
  )
}

function Body(props: { projectId: string; read: SlotsRead }) {
  const { read } = props
  if (read.kind === 'loading') return <p className={layout.muted}>Reading the slots…</p>
  if (read.kind === 'refused') return <p>{read.message}</p>
  if (read.slots.length === 0) {
    return <p className={layout.muted}>This campaign&apos;s template has no slots.</p>
  }
  return <Rows projectId={props.projectId} read={read} />
}

export function SlotView(props: SlotViewProps) {
  const read = useSlots(props.projectId, props.campaignId)
  return (
    <section aria-label="Slots" className={layout.field}>
      <h3 className={layout.label}>{HEADING}</h3>
      <Body projectId={props.projectId} read={read} />
    </section>
  )
}
