// SPEC 6.2 [FR-061, FR-062]; SPEC 14 slice H; SP-9 [A-127]. The pre-filled picture prompt,
// and the one fixed ending every picture and video prompt is sent with. Pure.

// A run that sends no picture.
export const NO_TEXT_ENDING =
  'Do not include any text, letters, numbers, logos or watermarks in the image.'

// A run that sends at least one picture. "No text" wiped the labels off products in the
// given pictures, and a product without its label is no use in an ad. It says "things",
// not "product", so it also fits a photo of a person.
export const KEEP_PRINTING_ENDING =
  'Keep any printing on the things in the given pictures exactly as it appears in them. ' +
  'Add no other text, letters, numbers, logos or watermarks anywhere in the image.'

const ENDINGS = [NO_TEXT_ENDING, KEEP_PRINTING_ENDING]

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

export function promptEnding(pictures: number): string {
  return pictures > 0 ? KEEP_PRINTING_ENDING : NO_TEXT_ENDING
}

// Takes app endings off the end, one at a time, until none is left. A pasted ending, a
// stored prompt on retry, or a count that changed then never leaves two endings.
function withoutEndings(prompt: string): string {
  let text = prompt.trim()
  for (;;) {
    const ending = ENDINGS.find((e) => text.endsWith(e))
    if (!ending) return text
    text = text.slice(0, -ending.length).trimEnd()
  }
}

// The prompt as it goes to the provider: trimmed, with the right ending once. `sent` is
// required so no caller can forget how many pictures go with the prompt.
export function promptToSend(prompt: string, sent: { pictures: number }): string {
  const text = withoutEndings(prompt)
  const ending = promptEnding(sent.pictures)
  return text ? `${text} ${ending}` : ending
}
