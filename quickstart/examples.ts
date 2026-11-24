// The quickstart's examples: each is a folder in quickstart/examples with a brief.yaml, the
// files it names and a brand folder. --brief runs any other brief in place of an example.
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const BRIEF_FILE = 'brief.yaml'

export type BriefChoice = { ok: true; path: string } | { ok: false; message: string }

// The brief to run. Pure: `found` is the list of example folders, read by listExamples.
export function chooseBrief(
  args: { brief: string | null; example: string },
  examplesFolder: string,
  found: readonly string[],
): BriefChoice {
  if (args.brief !== null) return { ok: true, path: resolve(args.brief) }
  if (found.includes(args.example)) {
    return { ok: true, path: join(examplesFolder, args.example, BRIEF_FILE) }
  }
  const list = found.length > 0 ? found.join(', ') : 'none'
  return { ok: false, message: `There is no example "${args.example}". The examples are: ${list}.` }
}

// The folders in the examples folder, in name order; none when it cannot be read.
export async function listExamples(examplesFolder: string): Promise<string[]> {
  const entries = await readdir(examplesFolder, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}
