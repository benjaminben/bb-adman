// R2E-10 (D8), SET-7: the steps of the first-run setup. Each later step is a Settings part as
// it is, drawn open with no fold, so a key is typed only into KeyRow. `heading` is the step's
// short name; `word` and `icon` draw it in the step strip.
import type { ComponentType } from 'react'
import type { IconName } from '@/renderer/ui/icon'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
import { ComfySection } from '@/renderer/screens/settings/comfy-section'
import { S3Section } from '@/renderer/screens/settings/s3-section'

type Part = ComponentType<{ fold?: 'open' | 'none' }>

export type Step = { heading: string; line: string; word: string; icon: IconName; Part: Part }

export const WELCOME = 'Add your service keys now, or skip and add them later in Settings.'

export const STEPS: readonly Step[] = [
  {
    heading: 'AI keys',
    line: 'One key or a ComfyUI server lets you make pictures and videos.',
    word: 'Keys',
    icon: 'key',
    Part: KeysSection,
  },
  {
    heading: 'ComfyUI server',
    line: 'Optional. Your own server makes pictures and videos at no charge.',
    word: 'ComfyUI',
    icon: 'image',
    Part: ComfySection,
  },
  {
    heading: 'Cloud storage',
    line: 'Optional. Where Publish sends finished ads.',
    word: 'Storage',
    icon: 'cloud',
    Part: S3Section,
  },
]
