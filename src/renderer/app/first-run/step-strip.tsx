// SET-7: the setup's step strip, one item per step with an icon and one word. The current step
// has aria-current="step" and the accent colour; a step already passed shows a check. On the
// welcome (`current` is -1) no step is current. Only a picture of where you are: no control.
import { Icon } from '@/renderer/ui/icon'
import { STEPS } from './steps'
import styles from './first-run.module.css'

export function StepStrip(props: { current: number }) {
  return (
    <ol aria-label="Steps" className={styles.strip}>
      {STEPS.map((step, i) => (
        <li
          key={step.word}
          className={styles.stripItem}
          aria-current={i === props.current ? 'step' : undefined}
          data-done={i < props.current ? '' : undefined}
        >
          <Icon name={i < props.current ? 'check' : step.icon} size="small" />
          {step.word}
        </li>
      ))}
    </ol>
  )
}
