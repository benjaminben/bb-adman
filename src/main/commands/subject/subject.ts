// subject.create, subject.update, subject.delete (SPEC 4.2; FR-011, FR-197). Not undoable.
import { eq } from 'drizzle-orm'
import type { CoreDeps } from '../../core-deps'
import { defineCommand, type ProjectContext } from '../types'
import { subject } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { AppError } from '../../../shared/schemas/result'
import {
  subjectCreateInput,
  subjectDeleteInput,
  subjectUpdateInput,
} from '../../../shared/schemas/commands/subject'

export function requireSubjectRow(ctx: ProjectContext, subjectId: string): void {
  if (!readWireRow(ctx.project.db, 'subject', { id: subjectId })) {
    throw new AppError('NOT_FOUND', 'That subject is not in this project.')
  }
}

export function subjectTaken(): AppError {
  return new AppError('RULE_VIOLATION', 'A subject with that ID is already in this project.')
}

// Inserts one subject row and names it. Also used by campaign.create (SPEC 6.1 subjectMap).
export function insertSubject(
  ctx: ProjectContext,
  row: { id: string; name: string; description: string; createdAt: string },
): void {
  if (readWireRow(ctx.project.db, 'subject', { id: row.id })) throw subjectTaken()
  ctx.project.orm.insert(subject).values(row).run()
  ctx.changes.touch('subject', { id: row.id })
}

function inUse(ctx: ProjectContext, subjectId: string): boolean {
  const db = ctx.project.db
  const campaign = db.prepare('SELECT 1 FROM campaign_subject WHERE subject_id = ?').get(subjectId)
  const variant = db.prepare('SELECT 1 FROM variant_subject WHERE subject_id = ?').get(subjectId)
  return campaign !== undefined || variant !== undefined
}

export function subjectCreate(deps: Pick<CoreDeps, 'now'>) {
  return defineCommand({
    name: 'subject.create',
    input: subjectCreateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const createdAt = deps.now().toISOString()
      insertSubject(ctx, {
        id: input.id,
        name: input.name,
        description: input.description,
        createdAt,
      })
      return { data: { subjectId: input.id } }
    },
  })
}

export function subjectUpdate() {
  return defineCommand({
    name: 'subject.update',
    input: subjectUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      requireSubjectRow(ctx, input.subjectId)
      const patch = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      }
      if (Object.keys(patch).length > 0) {
        ctx.project.orm.update(subject).set(patch).where(eq(subject.id, input.subjectId)).run()
        ctx.changes.touch('subject', { id: input.subjectId })
      }
      return { data: { subjectId: input.subjectId } }
    },
  })
}

// Refused while a campaign or a variant uses the subject. A file attached to it keeps its
// row and loses the subject (ON DELETE SET NULL, SPEC 3.3), so the bus is told of each one.
export function subjectDelete() {
  return defineCommand({
    name: 'subject.delete',
    input: subjectDeleteInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      requireSubjectRow(ctx, input.subjectId)
      if (inUse(ctx, input.subjectId)) {
        throw new AppError(
          'RULE_VIOLATION',
          'This subject is used by a campaign. Remove it from every campaign first.',
        )
      }
      const assets = ctx.project.db
        .prepare('SELECT id FROM asset WHERE subject_id = ?')
        .all(input.subjectId) as Array<{ id: string }>
      ctx.changes.touch('subject', { id: input.subjectId })
      for (const a of assets) ctx.changes.touch('asset', { id: a.id })
      ctx.project.orm.delete(subject).where(eq(subject.id, input.subjectId)).run()
      return { data: { subjectId: input.subjectId } }
    },
  })
}
