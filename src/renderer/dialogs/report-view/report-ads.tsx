// The report's ads in two panes (DLG-7): on the left one ObjectRow per ad with the variant's
// thumbnail, its title, "{size} · {language}" and one mark for how it came out ("Failed",
// "With warnings", "Passed every check", the words in its tooltip); on the right the picked
// ad's lines, unchanged (report-ad.tsx). Picking a row sends nothing.
import { useState } from 'react'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { Report, ReportVariant } from '@/shared/schemas/report'
import { ReportAd } from './report-ad'
import * as W from './report-words'
import styles from './report-view.module.css'

function Outcome(props: { report: Report; ad: ReportVariant }) {
  const { report, ad } = props
  if (ad.failure !== null) return <StatusMark tone="danger" icon="x" tip={W.LABELS.failed} />
  if (!report.checksRun) return null
  if (ad.checks.some((c) => c.status === 'warn'))
    return <StatusMark tone="warn" icon="alert" tip={W.LABELS.withWarnings} />
  return <StatusMark tone="ok" icon="check" tip={W.LABELS.passedAll} />
}

export function ReportAds(props: { projectId: string; report: Report }) {
  const { report } = props
  const [picked, setPicked] = useState<string>()
  const shown = report.variants.find((v) => v.variantId === picked) ?? report.variants[0]
  if (!shown) return null
  return (
    <div className={styles.panes}>
      <ul aria-label="Ads" className={styles.ads}>
        {report.variants.map((ad) => {
          const on = ad.variantId === shown.variantId
          return (
            <li key={ad.variantId} aria-label={ad.title}>
              <ObjectRow
                label={ad.title}
                name={ad.title}
                meta={`${ad.sizeLabel} · ${ad.language}`}
                thumb={
                  <VariantThumbnail
                    projectId={props.projectId}
                    variantId={ad.variantId}
                    rev={ad.rev}
                    alt=""
                  />
                }
                marks={<Outcome report={report} ad={ad} />}
                selected={on}
                mainProps={{ 'aria-current': on }}
                onSelect={() => setPicked(ad.variantId)}
              />
            </li>
          )
        })}
      </ul>
      <ReportAd key={shown.variantId} report={report} ad={shown} />
    </div>
  )
}
