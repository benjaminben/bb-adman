import type { PresetState } from '@/shared/scene/presets'

// phase-07.md "Presets", stagger-words: the words of a text as <span>s, each moved with top
// (position: relative keeps it in its place in the line) and faded on its own. White space
// stays plain text between them, so the lines break as they do without the spans.
type Props = { text: string; stateOf: (wordIndex: number, wordCount: number) => PresetState }

const isSpace = (part: string) => /^\s/.test(part)

export function WordSpans({ text, stateOf }: Props) {
  const parts = text.split(/(\s+)/).filter((part) => part !== '')
  const count = parts.filter((part) => !isSpace(part)).length
  let index = 0
  return parts.map((part, at) => {
    if (isSpace(part)) return part
    const { opacity, dy } = stateOf(index++, count)
    return (
      <span key={at} style={{ position: 'relative', top: dy, opacity }}>
        {part}
      </span>
    )
  })
}
