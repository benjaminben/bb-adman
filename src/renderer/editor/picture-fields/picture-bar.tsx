// ED-3: the icon bar on the picture's lower edge, in this order: Choose picture…, Crop…, Reset
// crop (only when cropped), Cut out the subject… (only when a provider can cut out), Remove
// picture; for the background, after a divider, Fill the canvas and Fit inside. Each button
// keeps its old words as its accessible name and title; a disabled one says why in its title.
// With no picture only the background's pair is drawn (Fill still applies to the empty box).
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './picture-fields.module.css'

export type BarButton = {
  icon: IconName
  name: string
  // Why the button is off, or null when it is on. '' means off for no reason a user can fix.
  off: string | null
  onClick: () => void
}

function BarItem(props: BarButton) {
  const why = props.off === null || props.off === '' ? props.name : props.off
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={props.name}
      title={why}
      disabled={props.off !== null}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
    </button>
  )
}

export function PictureBar(props: { main: BarButton[]; fit: BarButton[] }) {
  const { main, fit } = props
  return (
    <div className={styles.bar} data-picture-bar="">
      {main.map((b) => (
        <BarItem key={b.name} {...b} />
      ))}
      {main.length > 0 && fit.length > 0 && (
        <span role="separator" aria-orientation="vertical" className={styles.divider} />
      )}
      {fit.map((b) => (
        <BarItem key={b.name} {...b} />
      ))}
    </div>
  )
}
