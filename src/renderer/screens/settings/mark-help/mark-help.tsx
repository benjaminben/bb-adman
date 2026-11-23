// "How to mark steps" (spec/comfyui-custom.md "Screens" and "Marks", D-104): a folded part
// with the marks table in short form and one example title. It starts closed.
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import styles from './mark-help.module.css'

const MARKS: ReadonlyArray<[string, string]> = [
  ['adman: prompt', 'The prompt'],
  ['adman: seed', 'A new random number for each picture or video'],
  ['adman: width height', 'The width and the height'],
  ['adman: ref1 … ref8', 'Reference pictures 1 to 8'],
  ['adman: first-frame', 'The first frame of a video'],
  ['adman: frames', 'The frame count of a video'],
  ['adman: output', 'The step Adman takes the result from'],
]

export function MarkHelp() {
  return (
    <Section id="settings.comfyMarks" title="How to mark steps" level={4} fold="closed">
      <table className={layout.table}>
        <thead>
          <tr>
            <th scope="col">Step title</th>
            <th scope="col">What Adman fills</th>
          </tr>
        </thead>
        <tbody>
          {MARKS.map(([mark, what]) => (
            <tr key={mark}>
              <td>
                <code className={styles.mark}>{mark}</code>
              </td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.example}>
        Example: <code className={styles.mark}>adman: seed=noise_seed</code> fills the input named
        noise_seed.
      </p>
    </Section>
  )
}
