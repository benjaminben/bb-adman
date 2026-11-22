// One 24 by 24 stroke icon by name (spec/app-style.md "Icons and drawings"). Icons sit beside
// words and are decorative: hidden from assistive tech, never focusable, no title. The spinner
// turns (icon.module.css).
import { createElement } from 'react'
import { ICON_PATHS } from './icon-paths'
import styles from './icon.module.css'

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[]

type Props = { name: IconName; size?: 'normal' | 'small' }

export function Icon({ name, size = 'normal' }: Props) {
  const sized = size === 'small' ? `${styles.icon} ${styles.small}` : styles.icon
  // The spinner turns by itself wherever it is drawn (R2-Q).
  const className = name === 'spinner' ? `${sized} ${styles.spin}` : sized
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICON_PATHS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  )
}
