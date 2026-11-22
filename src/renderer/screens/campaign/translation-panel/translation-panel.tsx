// The Translations tab of the campaign page (spec/phases/phase-06.md, design addition 8; CAMP-5):
// no card and no heading. At the top right the InfoTip "About Translations" (R2C-4's line) and
// "Export translation sheet…"; then one Section per language other than the primary one, from
// translation.forCampaign read again on every change. Each language gets its newest jobs (P6-13)
// and the variants' revisions for the thumbnails. R3-3: first the primary language's block
// (source-group.tsx), then the others in the campaign's languages order (translation-order.ts).
import type { CampaignTabProps as CampaignSectionProps } from '@/renderer/screens/campaign/campaign-overview'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { ExportSheet } from './export-sheet'
import { LanguageGroup } from './language-group'
import { SourceGroup } from './source-group'
import { languageOrder } from './translation-order'
import { ABOUT, groupRows } from './translation-words'
import styles from './translation-panel.module.css'
import { type TranslationsRead, useTranslations } from './use-translations'

type BodyProps = {
  projectId: string
  campaignId: string
  read: TranslationsRead
  data: CampaignGet
  revs: ReadonlyMap<string, number>
  reload: () => void
}

function Body(props: BodyProps) {
  const { read } = props
  if (read.kind === 'loading') return <p className={layout.muted}>Loading the translations…</p>
  if (read.kind === 'refused') {
    return (
      <div className={`${layout.notice} ${layout.warn}`}>
        <span role="alert">{read.message}</span>
        <button type="button" className={`${layout.quiet} ${layout.small}`} onClick={props.reload}>
          Retry
        </button>
      </div>
    )
  }
  const groups = groupRows(read.data)
  const order = languageOrder(
    groups.map((g) => g.language),
    props.data.campaign,
  )
  const ordered = order.flatMap((code) => groups.filter((g) => g.language === code))
  const outOfDate = new Set(read.data.sources.outOfDate)
  const sources = read.data.sources.rows
  return (
    <>
      {sources.length > 0 && (
        <SourceGroup
          projectId={props.projectId}
          language={read.data.primaryLanguage}
          rows={sources}
          data={props.data}
          revs={props.revs}
          reload={props.reload}
        />
      )}
      {ordered.length === 0 && <p className={layout.muted}>No texts to translate yet.</p>}
      {ordered.map((group) => (
        <LanguageGroup
          key={group.language}
          projectId={props.projectId}
          campaignId={props.campaignId}
          language={group.language}
          primaryLanguage={read.data.primaryLanguage}
          rows={group.rows}
          jobs={read.data.jobs.filter((job) => job.language === group.language)}
          revs={props.revs}
          data={props.data}
          outOfDate={outOfDate}
          reload={props.reload}
        />
      ))}
    </>
  )
}

export function TranslationPanel(props: CampaignSectionProps) {
  const { read, reload } = useTranslations(props.projectId, props.campaignId)
  const revs = new Map(props.data.variants.map((v) => [v.id, v.rev]))
  return (
    <section className={styles.panel} aria-label="Translations">
      <div className={styles.top}>
        <InfoTip about="Translations">{ABOUT}</InfoTip>
        <ExportSheet projectId={props.projectId} campaignId={props.campaignId} />
      </div>
      <Body
        projectId={props.projectId}
        campaignId={props.campaignId}
        read={read}
        data={props.data}
        revs={revs}
        reload={reload}
      />
    </section>
  )
}
