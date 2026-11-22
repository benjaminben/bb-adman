// R2E-10 (D8): the steps of the first-run setup. Each later step is a Settings part as it is,
// so a key is typed only into KeyRow.
import type { ComponentType } from 'react'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
import { ComfySection } from '@/renderer/screens/settings/comfy-section'
import { S3Section } from '@/renderer/screens/settings/s3-section'

export type Step = { heading: string; line: string; Part: ComponentType | null }

export const STEPS: readonly Step[] = [
  {
    heading: 'Welcome',
    line: 'Add your service keys now, or skip and add them later in Settings.',
    Part: null,
  },
  {
    heading: 'Step 1 of 3: AI keys',
    line: 'One key or a ComfyUI server lets you make pictures and videos.',
    Part: KeysSection,
  },
  {
    heading: 'Step 2 of 3: ComfyUI server',
    line: 'Optional. Your own server makes pictures and videos at no charge.',
    Part: ComfySection,
  },
  {
    heading: 'Step 3 of 3: Cloud storage',
    line: 'Optional. Where Publish sends finished ads.',
    Part: S3Section,
  },
]
