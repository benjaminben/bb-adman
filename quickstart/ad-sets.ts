// The ad sets of a run (spec/quickstart.md, step 2): one set of all subjects for the campaign,
// or, with `adsPer: subject` and two or more subjects, one set per subject in brief order. Each
// set has its own plan, whose subjects are the set's only, so its picture prompt names them
// alone. Pure.
import { join } from 'node:path'
import { safeName } from './output'
import type { Plan } from './plan'

export type AdSet = {
  // The subject's name for a set per subject; null for the campaign's one set.
  name: string | null
  // The cleaned folder name under the campaign folder; null for the campaign's one set.
  folder: string | null
  plan: Plan
  // The places of the set's subjects in the brief's subject list.
  subjects: number[]
}

// Two subjects whose cleaned names are equal get -2, -3 and on, so no two share a folder.
function folderNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const base = safeName(name, 'subject').toLowerCase()
    let folder = base
    for (let n = 2; used.has(folder); n += 1) folder = `${base}-${n}`
    used.add(folder)
    return folder
  })
}

export function adSetsOf(plan: Plan): AdSet[] {
  const { subjects } = plan
  if (plan.look.adsPer !== 'subject' || subjects.length < 2) {
    return [{ name: null, folder: null, plan, subjects: subjects.map((_, at) => at) }]
  }
  const folders = folderNames(subjects.map((subject) => subject.name))
  return subjects.map((subject, at) => ({
    name: subject.name,
    folder: folders[at] ?? null,
    plan: { ...plan, subjects: [subject] },
    subjects: [at],
  }))
}

// Where a set's ads go: the campaign folder itself, or the set's own folder inside it.
export const setFolder = (campaign: string, set: AdSet) =>
  set.folder === null ? campaign : join(campaign, set.folder)

// The photos of the set's subjects, from the photos read per subject in brief order.
export function setPhotos<T>(set: AdSet, bySubject: readonly T[][]): T[] {
  return set.subjects.flatMap((at) => bySubject[at] ?? [])
}
