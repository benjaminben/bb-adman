// The size and video fields of "Change workflow" (spec/comfyui-custom.md "Screens", D-104).
// The size choices are the allowed options only; the video fields hold whole numbers in the
// allowed ranges, which the command checks again.
import { MAX_MEGAPIXEL_OPTIONS, SIZE_MULTIPLES } from '@/shared/comfy/custom-workflow'
import layout from '@/renderer/ui/layout.module.css'
import type { ChangeValues } from './change-values'
import styles from './change-workflow.module.css'

type FieldsProps = {
  values: ChangeValues
  onChange: (change: Partial<ChangeValues>) => void
}

const megapixelWords = (n: number) => (n === 1 ? '1 megapixel' : `${n} megapixels`)

export function SizeFields({ values, onChange }: FieldsProps) {
  return (
    <>
      <div className={layout.field}>
        <label htmlFor="change-workflow-largest">Largest size</label>
        <select
          id="change-workflow-largest"
          value={values.megapixels}
          onChange={(e) => onChange({ megapixels: e.target.value })}
        >
          {MAX_MEGAPIXEL_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {megapixelWords(n)}
            </option>
          ))}
        </select>
      </div>
      <div className={layout.field}>
        <label htmlFor="change-workflow-multiple">Sides are a multiple of</label>
        <select
          id="change-workflow-multiple"
          value={values.multiple}
          onChange={(e) => onChange({ multiple: e.target.value })}
        >
          {SIZE_MULTIPLES.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

function WholeNumber(props: {
  id: string
  value: string
  min: number
  max: number
  onChange: (value: string) => void
}) {
  return (
    <input
      id={props.id}
      type="number"
      inputMode="numeric"
      step={1}
      min={props.min}
      max={props.max}
      required
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  )
}

export function VideoFields({ values, onChange }: FieldsProps) {
  return (
    <>
      <div className={layout.field}>
        <label htmlFor="change-workflow-fps">Frames per second</label>
        <WholeNumber
          id="change-workflow-fps"
          value={values.fps}
          min={1}
          max={60}
          onChange={(fps) => onChange({ fps })}
        />
      </div>
      <div className={layout.field}>
        <label htmlFor="change-workflow-seconds">Longest clip, in seconds</label>
        <WholeNumber
          id="change-workflow-seconds"
          value={values.seconds}
          min={1}
          max={60}
          onChange={(seconds) => onChange({ seconds })}
        />
      </div>
      <fieldset className={styles.counts}>
        <legend className={styles.hidden}>Frame counts it takes</legend>
        <span aria-hidden="true">Frame counts it takes:</span>
        <label htmlFor="change-workflow-step">a multiple of</label>
        <WholeNumber
          id="change-workflow-step"
          value={values.frameStep}
          min={1}
          max={64}
          onChange={(frameStep) => onChange({ frameStep })}
        />
        <span aria-hidden="true">,</span>
        <label htmlFor="change-workflow-offset">plus</label>
        <WholeNumber
          id="change-workflow-offset"
          value={values.frameOffset}
          min={0}
          max={64}
          onChange={(frameOffset) => onChange({ frameOffset })}
        />
      </fieldset>
    </>
  )
}
