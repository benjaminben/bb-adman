// What the app leaves on the ComfyUI server (6.10.10; SET-2): plain information, so it folds and
// starts closed. Drawn only when there is something to say.
import { Section } from '@/renderer/ui/section'

export function OnServer(props: { sentences: string[] }) {
  if (props.sentences.length === 0) return null
  return (
    <Section id="settings.onServer" title="On the server" level={4} fold="closed">
      <ul>
        {props.sentences.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </ul>
    </Section>
  )
}
