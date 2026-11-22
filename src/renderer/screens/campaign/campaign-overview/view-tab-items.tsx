// The three campaign view tabs (spec/phases/round-2-campaign.md, design addition 1): an icon
// (hidden from assistive tech) and the word, which is the tab's name. Checks carries the
// warning badge after the word, read with the check panel's own hook so it follows
// project.changed. No badge at 0, while reading, or when the read is refused (R-8). CAMP-3: the
// badge's name is a real plural ("1 warning", "3 warnings").
import type { ReactNode } from 'react'
import { useCheckResults } from '@/renderer/screens/campaign/check-panel'
import { Icon, type IconName } from '@/renderer/ui/icon'
import { plural } from '@/renderer/ui/plural'
import type { TabItem } from '@/renderer/ui/tab-row'
import layout from '@/renderer/ui/layout.module.css'
import { warningCount } from './check-count'
import styles from './campaign-overview.module.css'

export type CampaignViewName = 'variants' | 'checks' | 'translations'

const label = (icon: IconName, word: string): ReactNode => (
  <span className={styles.label}>
    <Icon name={icon} size="small" />
    {word}
  </span>
)

function WarningBadge(props: { count: number }) {
  return (
    <span
      role="img"
      aria-label={plural(props.count, 'warning')}
      className={`${layout.badge} ${layout.warn} ${styles.badge}`}
    >
      {props.count}
    </span>
  )
}

export function useViewTabItems(projectId: string, campaignId: string): TabItem[] {
  const read = useCheckResults(projectId, campaignId)
  const warnings = read.kind === 'done' ? warningCount(read.states) : 0
  return [
    { value: 'variants', label: label('grid', 'Variants') },
    {
      value: 'checks',
      label: label('shield', 'Checks'),
      marks: warnings > 0 && <WarningBadge count={warnings} />,
    },
    { value: 'translations', label: label('globe', 'Translations') },
  ]
}
