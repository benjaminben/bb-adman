// The read-only summary of a parsed brief (SPEC 14 1.41 TP-1): the confirm step FR-023 asks
// for, in its plainest form. Every value is the brief's own text, drawn as text.
import type { BriefParsed } from '../../../shared/schemas/commands/brief'
import type { CampaignPlan } from './campaign-input'
import styles from '../screens.module.css'

function Row(props: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <dt className={styles.label}>{props.label}</dt>
      <dd className={styles.path}>{props.value}</dd>
    </div>
  )
}

export function BriefSummary(props: {
  reply: BriefParsed
  plan: CampaignPlan
  creating: boolean
  onCreate: () => void
  onCancel: () => void
}) {
  const { draft } = props.reply
  const { plan } = props
  const sizes = plan.ok ? plan.campaign.sizes.map((s) => s.label) : (draft.sizes ?? [])
  const languages = plan.ok ? plan.campaign.languages : (draft.languages ?? [])
  return (
    <section className={styles.card} aria-label="Brief">
      <h2>Brief</h2>
      <dl>
        <Row label="Campaign name" value={draft.campaignName ?? ''} />
        <Row label="Message" value={draft.message ?? ''} />
        <Row label="Audience" value={draft.audience ?? ''} />
        <Row label="Region" value={draft.region ?? ''} />
        <Row label="Subjects" value={(draft.subjects ?? []).map((s) => s.name ?? '').join(', ')} />
        <Row label="Sizes" value={sizes.join(', ')} />
        <Row label="Languages" value={languages.join(', ')} />
      </dl>
      {!plan.ok && (
        <ul aria-label="What the brief lacks">
          {plan.problems.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {props.creating && <p className={styles.muted}>Creating the campaign…</p>}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.primary}
          disabled={!plan.ok || props.creating}
          onClick={props.onCreate}
        >
          Create campaign
        </button>
        <button type="button" disabled={props.creating} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
