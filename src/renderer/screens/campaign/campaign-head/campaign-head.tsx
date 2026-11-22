// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign page's head. CAMP-3
// (spec/phases/design-wave-screens-b.md, "CAMP-3"): one row. "Back to project" as an icon
// button; the campaign's name; the paid count as its mark while a campaign view shows (`paid`);
// the approvals button and Refresh (AP-11); "Export…" (P8-11); a More menu with "Reports…",
// which opens the reports dialog (CAMP-6's useReports); "Publish…" (P9-13), the one primary;
// "Assets" as an icon button (R2C-5, drawn only inside its scope). Each opens its dialog and
// sends nothing itself.
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { ApprovalBar } from '@/renderer/screens/campaign/approval-bar'
import { CampaignExport } from '@/renderer/screens/campaign/campaign-export'
import { PublishButton } from '@/renderer/screens/campaign/publish-button'
import { useReports } from '@/renderer/screens/campaign/report-list'
import type { ApprovalsStore } from '@/renderer/stores/approvals-store'
import { Icon } from '@/renderer/ui/icon'
import { MoreMenu } from '@/renderer/ui/more-menu'
import { PaidCount } from '@/renderer/ui/paid-count'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-head.module.css'

export type CampaignHeadProps = {
  projectId: string
  campaignId: string
  data: CampaignGet | null
  approvals: ApprovalsStore
  onBack: () => void
  paid?: boolean
}

export function CampaignHead(props: CampaignHeadProps) {
  const { projectId, campaignId, data } = props
  const reports = useReports(projectId, campaignId)
  const reportsItem = { id: 'reports', label: 'Reports…', icon: 'book' as const }
  return (
    <div className={styles.head}>
      <button
        type="button"
        className={layout.iconButton}
        aria-label="Back to project"
        title="Back to project"
        onClick={props.onBack}
      >
        <Icon name="left" />
      </button>
      {data && <h2 className={styles.name}>{data.campaign.name}</h2>}
      {props.paid && <PaidCount projectId={projectId} campaignId={campaignId} />}
      {data && (
        <ApprovalBar
          projectId={projectId}
          campaignId={campaignId}
          store={props.approvals}
          titles={Object.fromEntries(data.variants.map((v) => [v.id, v.title]))}
        />
      )}
      <CampaignExport projectId={projectId} campaignId={campaignId} reports={false} />
      {data && (
        <MoreMenu label={data.campaign.name} items={[{ ...reportsItem, onChoose: reports.open }]} />
      )}
      {data && (
        <PublishButton
          projectId={projectId}
          campaignId={campaignId}
          campaignName={data.campaign.name}
        />
      )}
      <AssetsButton projectId={projectId} icon glyph="box" />
      {reports.dialog}
    </div>
  )
}
