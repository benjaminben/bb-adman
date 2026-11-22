// The brief form's sizes (spec/screens-campaign.md, "The brief form", Sizes; FR-026; HOME-3a):
// a Section "Sizes" holding one toggle chip per ready-made size, a chip for each typed size
// that can be read, and the "Other" field. A chosen chip carries a ★ that makes it the master;
// the first chosen size is the master by default (masterOf). A chip turned on goes to the end
// of the chosen sizes, so a brief's order is kept. Typed chips are removed by editing the field.
import { useId } from 'react'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { READY_MADE_SIZES } from '@/shared/config/defaults'
import {
  masterOf,
  sizesInOrder,
  type SizeChoice,
} from '@/renderer/screens/project-home/brief-form-sizes'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { SizeChip } from './size-chip'
import styles from './size-fields.module.css'

const isReadyMade = (label: string) => READY_MADE_SIZES.some((s) => s.label === label)
const HINT = 'Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628.'

// "1x1 (1080×1080)" for a ready-made size, "1200×628" for any other.
export function sizeText(size: CampaignSize): string {
  const pixels = `${size.width}×${size.height}`
  return isReadyMade(size.label) ? `${size.label} (${pixels})` : pixels
}

export function SizeFields(props: { sizes: SizeChoice; onChange: (sizes: SizeChoice) => void }) {
  const { sizes } = props
  const hint = useId()
  const master = masterOf(sizes)
  // The ready-made labels are always read, so the typed sizes are the rest, in order.
  const typed = sizesInOrder(sizes).slice(sizes.readyMade.length)
  const set = (patch: Partial<SizeChoice>) => props.onChange({ ...sizes, ...patch })
  const flip = (label: string) =>
    set({
      readyMade: sizes.readyMade.includes(label)
        ? sizes.readyMade.filter((l) => l !== label)
        : [...sizes.readyMade, label],
    })
  const star = (label: string) => ({
    master: label === master,
    onMaster: () => set({ master: label }),
  })

  return (
    <Section id="brief.sizes" title="Sizes" fold="none">
      <div role="group" aria-label="Sizes" className={styles.sizes}>
        <div className={styles.chips}>
          {READY_MADE_SIZES.map((s) => {
            const chosen = sizes.readyMade.includes(s.label)
            return (
              <SizeChip
                key={s.label}
                size={s}
                name={sizeText(s)}
                chosen={chosen}
                onToggle={() => flip(s.label)}
                {...(chosen ? star(s.label) : {})}
              />
            )
          })}
          {typed.map((s, i) => (
            <SizeChip key={`${i}-${s.label}`} size={s} chosen {...star(s.label)} />
          ))}
        </div>
        <div className={`${layout.field} ${layout.inline} ${styles.other}`}>
          <label htmlFor={`${hint}-other`}>Other</label>
          <span className={styles.otherBox}>
            <input
              id={`${hint}-other`}
              aria-label="Other sizes"
              placeholder="4:5, 1200x628"
              value={sizes.other}
              aria-describedby={hint}
              onChange={(e) => set({ other: e.target.value })}
            />
            <InfoTip about="Other sizes">{HINT}</InfoTip>
          </span>
          <span id={hint} className={styles.hidden}>
            {HINT}
          </span>
        </div>
      </div>
    </Section>
  )
}
