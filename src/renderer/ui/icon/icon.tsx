// One 24 by 24 stroke icon by name (spec/app-style.md "Icons and drawings"). Icons sit beside
// words and are decorative: hidden from assistive tech, never focusable, no title.
import { createElement } from 'react'
import { ICON_PATHS } from './icon-paths'
import styles from './icon.module.css'

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[]

type Props = { name: IconName; size?: 'normal' | 'small' }

export function Icon({ name, size = 'normal' }: Props) {
  const className = size === 'small' ? `${styles.icon} ${styles.small}` : styles.icon
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICON_PATHS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  )
}
