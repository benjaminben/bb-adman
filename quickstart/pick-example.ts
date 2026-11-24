// The quickstart's first question: which example to run. It is asked only when the run names
// no example and no brief, and only in a terminal a person types into; anywhere else (a pipe,
// a script) the default example runs with no question.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { adSetsOf } from './ad-sets'
import { DEFAULT_EXAMPLE } from './args'
import { BRIEF_FILE } from './examples'
import { readPlan } from './plan'

export type ExampleChoice = { name: string; about: string }

const QUESTION = 'Type a number and press Enter (Enter alone runs 1): '

const some = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// The examples in the order they are offered: the default first, then by name. Pure.
export function offered(found: readonly string[]): string[] {
  const rest = found.filter((name) => name !== DEFAULT_EXAMPLE).sort()
  return found.includes(DEFAULT_EXAMPLE) ? [DEFAULT_EXAMPLE, ...rest] : rest
}

// What an example makes, read from its brief's text. Pure.
export function aboutExample(briefText: string): string {
  const planned = readPlan(briefText, 'yaml')
  if (!planned.ok) return 'its brief cannot be read'
  const { plan } = planned
  const sets = adSetsOf(plan).length
  const subjects =
    sets > 1
      ? `one set of ads for each of ${sets} subjects`
      : `${some(plan.subjects.length, 'subject')}${plan.subjects.length > 1 ? ' in one picture' : ''}`
  const ads = sets * plan.languages.length * plan.sizes.length
  const parts = [subjects, some(plan.languages.length, 'language'), some(plan.sizes.length, 'size')]
  return `${parts.join(', ')}: ${some(ads, 'ad')}`
}

// The lines printed above the question. Pure.
export function pickerLines(choices: readonly ExampleChoice[]): string[] {
  const width = Math.max(...choices.map((choice) => choice.name.length))
  return [
    'Which example do you want to run?',
    '',
    ...choices.map((c, at) => `  ${at + 1}. ${c.name.padEnd(width)}   ${c.about}`),
    '',
    'To skip this question next time, add --example=<name>.',
  ]
}

// The example a typed answer means: nothing typed is the first, a number is its place in the
// list, a name is itself. null: not one of the choices. Pure.
export function pickedExample(answer: string, names: readonly string[]): string | null {
  const typed = answer.trim()
  if (typed === '') return names[0] ?? null
  if (/^\d+$/.test(typed)) return names[Number(typed) - 1] ?? null
  return names.find((name) => name === typed.toLowerCase()) ?? null
}

// The example to run when the options name none; null when the person ended the input
// (Ctrl+C or Ctrl+D).
export async function askExample(
  examplesFolder: string,
  found: readonly string[],
  say: (line?: string) => void,
): Promise<string | null> {
  const names = offered(found)
  const first = names[0] ?? DEFAULT_EXAMPLE
  if (names.length < 2 || !process.stdin.isTTY || !process.stdout.isTTY) return first
  const choices = await Promise.all(
    names.map(async (name) => {
      const text = await readFile(join(examplesFolder, name, BRIEF_FILE), 'utf8').catch(() => '')
      return { name, about: aboutExample(text) }
    }),
  )
  for (const line of pickerLines(choices)) say(line)
  // One reader for every answer, so lines typed ahead or pasted together are all read.
  const typed = createInterface({ input: process.stdin, output: process.stdout, prompt: QUESTION })
  typed.once('SIGINT', () => typed.close())
  typed.prompt()
  try {
    for await (const answer of typed) {
      const picked = pickedExample(answer, names)
      if (picked !== null) {
        say()
        return picked
      }
      say(`"${answer.trim()}" is not one of the choices.`)
      typed.prompt()
    }
    return null
  } finally {
    typed.close()
  }
}
