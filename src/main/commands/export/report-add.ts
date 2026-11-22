// report.add (spec/phases/phase-08.md "Report", saved). System command: the export job saves
// its report row through it, after the report files are written. Deny and internal, so no
// window and no agent can send it. Not undoable. The row is not named for project.changed, so
// no event carries the output folder's full path or the body (A-196); the window reads the
// reports with report.list.
import { ulid } from 'ulid'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { report } from '@/main/db/schema'
import { requireCampaign } from '@/main/queries/campaign-reads'
import {
  reportAddInput,
  type ReportAddInput,
  type ReportAddReply,
} from '@/shared/schemas/commands/export'
import { AppError } from '@/shared/schemas/result'

const NAME = 'report.add'

export function reportAdd(_deps: CoreDeps) {
  return defineCommand({
    name: NAME,
    internal: true,
    input: reportAddInput,
    projectId: (input) => input.projectId,
    run(ctx, input: ReportAddInput): HandlerResult<ReportAddReply> {
      requireCampaign(ctx.project.db, input.campaignId)
      if (input.report.campaignId !== input.campaignId) {
        throw new AppError('INVALID_INPUT', 'The report is not of this campaign.')
      }
      const reportId = ulid()
      ctx.project.orm
        .insert(report)
        .values({
          id: reportId,
          campaignId: input.campaignId,
          createdAt: input.report.createdAt,
          outputDir: input.outputDir,
          body: JSON.stringify(input.report),
        })
        .run()
      return { data: { reportId }, log: { campaignId: input.campaignId } }
    },
  })
}
