// ED-1b (spec/phases/design-wave-screens-a.md, choice C-3): the properties panel's head and its
// empty state. The head is the layer's type icon (as on its row) and its name; a locked layer
// adds a "Locked" mark at the right end that unlocks it. The kind word is gone. With nothing
// selected: "Select a layer", and on a video post an InfoTip saying where videos are made.
import { useApp } from '@/renderer/app/app-context'
import { EmptyState } from '@/renderer/ui/empty-state'
import type { IconName } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import { PanelHead } from '@/renderer/ui/panel-head'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './properties-panel.module.css'

const TYPE_ICON: Record<LayerRow['type'], IconName> = {
  background: 'layers',
  image: 'image',
  text: 'text',
}

// The unlock goes through the app store, so a refusal shows in the editor's banner.
export function PanelTop(props: { projectId: string; layer: LayerRow }) {
  const { layer } = props
  const command = useApp((s) => s.command)
  const unlock = () =>
    void command('layer.update', {
      projectId: props.projectId,
      layerId: layer.id,
      patch: { locked: false },
    })
  return (
    <div className={styles.head}>
      <PanelHead level={3} icon={TYPE_ICON[layer.type]} title={layer.name} />
      {layer.locked && (
        <span className={styles.lock}>
          <StatusMark
            tone="none"
            icon="lock"
            label="Locked"
            tip="Locked. Unlock"
            onClick={unlock}
          />
        </span>
      )}
    </div>
  )
}

export function PanelEmpty(props: { video: boolean }) {
  return (
    <div className={styles.empty}>
      <EmptyState icon="layers" words="Select a layer" />
      {props.video && (
        <InfoTip about="making a video">To make a video, select the background layer.</InfoTip>
      )}
    </div>
  )
}
