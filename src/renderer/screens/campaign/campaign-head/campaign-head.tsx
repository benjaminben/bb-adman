// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign page's head, moved
// out of the page with no change in what it shows. "Back to project", the campaign's name, the
// approval bar (AP-11), "Export…" with "Reports" (P8-11) and "Publish…" (P9-13).
import { ApprovalBar } from '@/renderer/screens/campaign/approval-bar'
import { CampaignExport } from '@/renderer/screens/campaign/campaign-export'
import { PublishButton } from '@/renderer/screens/campaign/publish-button'
import type { ApprovalsStore } from '@/renderer/stores/approvals-store'
import { Icon } from '@/renderer/ui/icon'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-head.module.css'

export type CampaignHeadProps = {
  projectId: string
  campaignId: string
  data: CampaignGet | null
  approvals: ApprovalsStore
  onBack: () => void
}

export function CampaignHead(props: CampaignHeadProps) {
  const { projectId, campaignId, data } = props
  return (
    <div className={styles.head}>
      <button type="button" className={layout.quiet} onClick={props.onBack}>
        <Icon name="left" />
        Back to project
      </button>
      {data && <h2 className={styles.name}>{data.campaign.name}</h2>}
      {data && (
        <ApprovalBar
          projectId={projectId}
          campaignId={campaignId}
          store={props.approvals}
          titles={Object.fromEntries(data.variants.map((v) => [v.id, v.title]))}
        />
      )}
      <CampaignExport projectId={projectId} campaignId={campaignId} />
      {data && (
        <PublishButton
          projectId={projectId}
          campaignId={campaignId}
          campaignName={data.campaign.name}
        />
      )}
    </div>
  )
}
