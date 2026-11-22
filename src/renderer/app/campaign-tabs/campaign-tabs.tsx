// spec/editor.md, "The shell" [FR-211, FR-218]: the shown project's tabs, labelled "Open
// campaigns": a fixed "Project" tab (the project home: a home icon, its name "Project" hidden,
// tooltip "Project home"), one tab per open campaign named after it with its job marks (the
// tab keeps room for one) and a close button ("Close {name}"), then a "+" icon button ("New
// campaign", with the same tooltip) that shows the Project tab and asks its project home to
// open the typed brief form (R2-Q). Names and marks come from project.get; a campaign
// that is gone loses its tab. It goes inside a Tabs.Root driven by useCampaignTab. Closing a
// campaign tab while an attached job of its variant tabs, or of the campaign itself (its
// translation jobs, P6-13), runs asks first (spec/screens-ai.md).
import { useEffect } from 'react'
import { useNav, useNavStore, useNewCampaignAsk } from '@/renderer/app/nav-context'
import { useProject } from '@/renderer/screens/project-home/project-home/use-project'
import { PROJECT_TAB, campaignNav, projectNav } from '@/renderer/stores/nav-store'
import { campaignJobs, variantJobs } from '@/renderer/stores/attached-store'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { TabMarks, anyMark } from '@/renderer/ui/tab-marks'
import { TabRow, type TabItem } from '@/renderer/ui/tab-row'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-tabs.module.css'

const PROJECT_LABEL = (
  <span className={styles.home} title="Project home">
    <Icon name="home" />
    <span className={styles.hidden}>Project</span>
  </span>
)

export function useCampaignTab(projectId: string) {
  const value = useNav((s) => projectNav(s, projectId).shown)
  const showCampaign = useNav((s) => s.showCampaign)
  return { value, onValueChange: (tab: string) => showCampaign(projectId, tab) }
}

export function CampaignTabs(props: { projectId: string }) {
  const { projectId } = props
  const data = useProject(projectId)
  const nav = useNav((s) => projectNav(s, projectId))
  const showCampaign = useNav((s) => s.showCampaign)
  const closeCampaign = useNav((s) => s.closeCampaign)
  const keepCampaigns = useNav((s) => s.keepCampaigns)
  const navStore = useNavStore()
  const askNewCampaign = useNewCampaignAsk().ask
  const { ask, warning } = useCloseWarning('tab')
  const campaigns = data?.campaigns
  const close = (campaignId: string) => {
    const variantTabs = campaignNav(navStore.getState(), projectId, campaignId).variantTabs
    ask(
      (s) => [...variantJobs(s, projectId, variantTabs), ...campaignJobs(s, projectId, campaignId)],
      () => closeCampaign(projectId, campaignId),
    )
  }

  useEffect(() => {
    if (campaigns)
      keepCampaigns(
        projectId,
        campaigns.map((c) => c.id),
      )
  }, [keepCampaigns, projectId, campaigns])

  const items: TabItem[] = [{ value: PROJECT_TAB, label: PROJECT_LABEL }]
  for (const id of nav.campaignTabs) {
    const c = campaigns?.find((one) => one.id === id)
    if (!c) continue
    const marks = { running: c.jobRunning, unseen: c.resultUnseen }
    items.push({
      value: id,
      label: c.name,
      marks: anyMark(marks) && <TabMarks {...marks} />,
      close: { label: `Close ${c.name}`, onClose: () => close(id) },
    })
  }
  const shown = items.some((item) => item.value === nav.shown) ? nav.shown : PROJECT_TAB

  return (
    <div className={styles.row}>
      <TabRow label="Open campaigns" items={items} value={shown} look="bar" />
      <button
        type="button"
        className={`${layout.iconButton} ${styles.add}`}
        aria-label="New campaign"
        title="New campaign"
        onClick={() => {
          showCampaign(projectId, PROJECT_TAB)
          askNewCampaign(projectId)
        }}
      >
        <Icon name="plus" />
      </button>
      {warning}
    </div>
  )
}
