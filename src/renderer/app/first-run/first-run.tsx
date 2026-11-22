// R2E-10 (spec/phases/round-2-editor.md D8), SET-7: the first-run setup, a welcome then three
// steps that hold Settings parts, as a form dialog with a step strip. Next never needs anything
// filled in. Every ending (Finish, Skip for now, Escape) sends settings.update { setup: { done:
// true } } once and closes; a refusal is not shown, so the setup shows again on a later start.
// The flow adds no command of its own for keys: KeyRow sends secret.set and holds the typed
// value.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { STEPS, WELCOME } from './steps'
import { StepStrip } from './step-strip'
import { closeSetup, showStep, useFirstRunRule, useFirstRunStore } from './use-first-run'
import styles from './first-run.module.css'

const LAST = STEPS.length

// On a step change the step's heading takes the focus; on opening, the frame places it. Its
// name is "Step n of 3: {short name}"; the first words are for a screen reader only. The
// welcome's heading is for a screen reader only.
function StepHeading(props: { step: number; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (props.focus) ref.current?.focus()
  }, [props.focus])
  const shown = STEPS[props.step - 1]
  if (shown === undefined) {
    return (
      <h2 ref={ref} tabIndex={-1} className={styles.hidden}>
        Welcome
      </h2>
    )
  }
  return (
    <div className={styles.headingRow}>
      <h2 ref={ref} tabIndex={-1} className={styles.heading}>
        <span className={styles.hidden}>{`Step ${props.step} of ${STEPS.length}:`}</span>{' '}
        {shown.heading}
      </h2>
      <InfoTip about="this step">{shown.line}</InfoTip>
    </div>
  )
}

export function FirstRun() {
  useFirstRunRule()
  const api = useApi()
  const step = useFirstRunStore((s) => s.step)
  const [moved, setMoved] = useState(false)
  const current = step ?? 0
  const shown = STEPS[current - 1]

  function go(next: number) {
    setMoved(true)
    showStep(next)
  }

  function end() {
    if (useFirstRunStore.getState().step === null) return
    setMoved(false)
    closeSetup()
    void api.command('settings.update', { setup: { done: true } })
  }

  const footer = (
    <>
      {current > 0 && (
        <button type="button" className={styles.back} onClick={() => go(current - 1)}>
          Back
        </button>
      )}
      <button type="button" className={layout.quiet} onClick={end}>
        Skip for now
      </button>
      <button
        type="button"
        className={layout.primary}
        onClick={() => (current === LAST ? end() : go(current + 1))}
      >
        {current === 0 ? 'Start' : current === LAST ? 'Finish' : 'Next'}
      </button>
    </>
  )

  return (
    <DialogFrame
      open={step !== null}
      onClose={end}
      title="Set up AdManager"
      {...(current === 0 && { description: WELCOME })}
      kind="form"
      size="wide"
      footer={footer}
    >
      <StepStrip current={current - 1} />
      <StepHeading key={current} step={current} focus={moved} />
      {shown !== undefined && <shown.Part fold="none" />}
    </DialogFrame>
  )
}
