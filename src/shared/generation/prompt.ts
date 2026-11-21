// SPEC 6.2 [FR-061, FR-062]; SPEC 14 slice H. The pre-filled picture prompt, and the fixed
// "no text" ending every picture prompt is sent with. Pure.

export const NO_TEXT_ENDING =
  'Do not include any text, letters, numbers, logos or watermarks in the image.'

export type PromptFacts = {
  subjects: Array<{ name: string; description: string | null }>
  audience: string
  region: string
  message: string
}

function subjectText(subject: PromptFacts['subjects'][number]): string {
  const description = subject.description?.trim() ?? ''
  return description ? `${subject.name.trim()} (${description})` : subject.name.trim()
}

// The text the user starts from and can edit. It holds no ending: promptToSend adds it.
export function prefilledPrompt(facts: PromptFacts): string {
  const subjects = facts.subjects.map(subjectText).filter((s) => s.length > 0)
  const what = subjects.length > 0 ? `A picture of ${subjects.join(' and ')}` : 'A picture'
  return (
    `${what} for an advertisement aimed at ${facts.audience.trim()} in ${facts.region.trim()}. ` +
    `The advertisement's message: ${facts.message.trim()}`
  )
}

// The prompt as it goes to the provider: trimmed, with the fixed ending once.
export function promptToSend(prompt: string): string {
  const text = prompt.trim()
  if (text.endsWith(NO_TEXT_ENDING)) return text
  return `${text} ${NO_TEXT_ENDING}`
}
