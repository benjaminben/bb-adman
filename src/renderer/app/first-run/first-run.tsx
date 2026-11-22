// R2E-10 (spec/phases/round-2-editor.md D8): the first-run setup, a welcome then three steps
// that hold Settings parts. Next never needs anything filled in. Every ending (Finish, Skip for
// now, Escape) sends settings.update { setup: { done: true } } once and closes; a refusal is
// not shown, so the setup shows again on a later start. The flow adds no command of its own
// for keys: KeyRow sends secret.set and holds the typed value.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { STEPS } from './steps'
import { closeSetup, showStep, useFirstRunRule, useFirstRunStore } from './use-first-run'
import styles from './first-run.module.css'

const LAST = STEPS.length - 1

// On a step change the step's heading takes the focus; on opening, the frame places it.
function StepHeading(props: { text: string; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (props.focus) ref.current?.focus()
  }, [props.focus])
  return (
    <h2 ref={ref} tabIndex={-1} className={styles.heading}>
      {props.text}
    </h2>
  )
}

export function FirstRun() {
  useFirstRunRule()
  const api = useApi()
  const step = useFirstRunStore((s) => s.step)
  const [moved, setMoved] = useState(false)
  const shown = STEPS[step ?? 0]!

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

  const current = step ?? 0
  const footer = (
    <>
      {current > 0 && (
        <button type="button" className={styles.back} onClick={() => go(current - 1)}>
          Back
        </button>
      )}
      <button type="button" onClick={end}>
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
      description={shown.line}
      size="wide"
      footer={footer}
    >
      <StepHeading key={current} text={shown.heading} focus={moved} />
      {shown.Part !== null && <shown.Part />}
    </DialogFrame>
  )
}
