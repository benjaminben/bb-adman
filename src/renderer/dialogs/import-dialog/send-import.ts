// The import dialog's send step (spec/screens-campaign.md, "The import dialog"; R2C-7,
// spec/phases/round-2-campaign.md, design addition 5). With "New subject…" chosen it first
// sends subject.create (the ID made from the name, stepping around the project's subject IDs);
// a refused create imports nothing. Then asset.import with the paths the dialog was given: the
// paths go to that command and nowhere else.
import { newSubjectId } from '@/renderer/dialogs/subject-dialog/subject-plan'
import type { AdmanApi } from '@/shared/schemas/api'
import type { Result } from '@/shared/schemas/result'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { animatedNames } from './animated-names'
import { NEW_SUBJECT, type Choices } from './import-choices'
import { animationLines, resultLines, type ImportReply } from './import-text'

type Command = (name: string, input: unknown) => Promise<Result<unknown>>

export type ImportTo = {
  projectId: string
  paths: string[]
  choices: Choices
  subjects: SubjectRow[]
}

// `refused` keeps the dialog's choices so Import can be sent again; `done` is the result.
export type SendOutcome = { kind: 'refused'; message: string } | { kind: 'done'; lines: string[] }

export function importProblem(choices: Choices): string | null {
  if (choices.subjectId !== NEW_SUBJECT) return null
  return choices.subjectName.trim() === '' ? "Enter the subject's name." : null
}

async function makeSubject(command: Command, to: ImportTo) {
  const name = to.choices.subjectName.trim()
  const id = newSubjectId(name, to.subjects)
  const made = await command('subject.create', {
    projectId: to.projectId,
    id,
    name,
    description: '',
  })
  return made.ok
    ? { ok: true as const, id, name }
    : { ok: false as const, message: made.error.message }
}

export async function sendImport(
  api: AdmanApi,
  command: Command,
  to: ImportTo,
): Promise<SendOutcome> {
  const { library, copy } = to.choices
  let subjectId = to.choices.subjectId
  let madeName: string | null = null
  if (subjectId === NEW_SUBJECT) {
    const made = await makeSubject(command, to)
    if (!made.ok) return { kind: 'refused', message: made.message }
    subjectId = made.id
    madeName = made.name
  }
  const reply = await command('asset.import', {
    projectId: to.projectId,
    paths: to.paths,
    library,
    copy,
    ...(subjectId !== '' && { subjectId }),
  })
  if (!reply.ok) {
    const message = reply.error.message
    if (madeName === null) return { kind: 'refused', message }
    const line = `${madeName} was made, but the files could not be imported: ${message}`
    return { kind: 'done', lines: [line] }
  }
  const data = reply.data as ImportReply
  const animated = data.animatedAssetIds ?? []
  const names = await animatedNames(api, to.projectId, animated)
  return { kind: 'done', lines: [...resultLines(data), ...animationLines(animated, names)] }
}
