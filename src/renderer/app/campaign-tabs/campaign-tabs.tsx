// spec/editor.md, "The shell" [FR-211, FR-218]: the shown project's tabs, labelled "Open
// campaigns": a fixed "Project" tab (the project home), one tab per open campaign named after
// it with its job marks and a close button ("Close {name}"), then a "+" button ("Open or start
// a campaign") that shows the Project tab. Names and marks come from project.get; a campaign
// that is gone loses its tab. It goes inside a Tabs.Root driven by useCampaignTab.
import { useEffect } from 'react'
import { useNav } from '@/renderer/app/nav-context'
import { useProject } from '@/renderer/screens/project-home/project-home/use-project'
import { PROJECT_TAB, projectNav } from '@/renderer/stores/nav-store'
import { TabMarks, anyMark } from '@/renderer/ui/tab-marks'
import { TabRow, type TabItem } from '@/renderer/ui/tab-row'
import styles from './campaign-tabs.module.css'

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
  const campaigns = data?.campaigns

  useEffect(() => {
    if (campaigns)
      keepCampaigns(
        projectId,
        campaigns.map((c) => c.id),
      )
  }, [keepCampaigns, projectId, campaigns])

  const items: TabItem[] = [{ value: PROJECT_TAB, label: 'Project' }]
  for (const id of nav.campaignTabs) {
    const c = campaigns?.find((one) => one.id === id)
    if (!c) continue
    const marks = { running: c.jobRunning, unseen: c.resultUnseen }
    items.push({
      value: id,
      label: c.name,
      marks: anyMark(marks) && <TabMarks {...marks} />,
      close: { label: `Close ${c.name}`, onClose: () => closeCampaign(projectId, id) },
    })
  }
  const shown = items.some((item) => item.value === nav.shown) ? nav.shown : PROJECT_TAB

  return (
    <div className={styles.row}>
      <TabRow label="Open campaigns" items={items} value={shown} />
      <button
        type="button"
        className={styles.add}
        aria-label="Open or start a campaign"
        onClick={() => showCampaign(projectId, PROJECT_TAB)}
      >
        +
      </button>
    </div>
  )
}
