// The "Translations" section of the campaign overview (spec/phases/phase-06.md, design
// addition 8): one group per language other than the primary one, from translation.forCampaign
// read again on every change. "Export translation sheet…" at the top; each group gets its
// language's newest jobs (P6-13).
import type { CampaignTabProps as CampaignSectionProps } from '@/renderer/screens/campaign/campaign-overview'
import layout from '@/renderer/ui/layout.module.css'
import { ExportSheet } from './export-sheet'
import { LanguageGroup } from './language-group'
import { groupRows } from './translation-words'
import { type TranslationsRead, useTranslations } from './use-translations'

type BodyProps = {
  projectId: string
  campaignId: string
  read: TranslationsRead
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
  if (groups.length === 0) return <p className={layout.muted}>No texts to translate yet.</p>
  return groups.map((group) => (
    <LanguageGroup
      key={group.language}
      projectId={props.projectId}
      campaignId={props.campaignId}
      language={group.language}
      rows={group.rows}
      jobs={read.data.jobs.filter((job) => job.language === group.language)}
      reload={props.reload}
    />
  ))
}

export function TranslationPanel(props: CampaignSectionProps) {
  const { read, reload } = useTranslations(props.projectId, props.campaignId)
  return (
    <section className={layout.card} aria-labelledby="translations-heading">
      <h2 id="translations-heading">Translations</h2>
      <ExportSheet projectId={props.projectId} campaignId={props.campaignId} />
      <Body projectId={props.projectId} campaignId={props.campaignId} read={read} reload={reload} />
    </section>
  )
}
