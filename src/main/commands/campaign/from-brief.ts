// campaign.createFromBrief and campaign.createFromBriefWithFiles (spec/phases/round-2-platform.md,
// D6): two command names, one handler, so the agent policy table stays static. The plain one
// (allow) refuses a brief that names a full path; the files one (ask) refuses a brief that names
// none, and runs only after the user allowed. prepare checks the brief and, for the files
// command, checks and copies each file exactly as asset.importFiles does (prepareFileImport).
// run, in one transaction, checks the brief again against the project, inserts the imported
// rows, makes the new subjects, attaches each picture and makes the campaign as campaign.create
// does. Any refusal writes nothing, and the copies are removed. The text is never stored.
import type { CoreDeps } from '@/main/core-deps'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import { insertSubject } from '@/main/commands/subject/subject'
import { insertImportedRows } from '@/main/commands/asset/import-files'
import { removeCopies, type PreparedImport } from '@/main/assets/import'
import { prepareFileImport } from '@/main/assets/import-files'
import { logUnreadable } from '@/main/assets/unreadable'
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import { createCampaignRows } from './create'
import { attachPictures } from './from-brief-pictures'
import { briefPlan, type BriefPlan } from './from-brief-plan'

export type FromBriefName = 'campaign.createFromBrief' | 'campaign.createFromBriefWithFiles'

export type BriefCreated = CampaignCreated & { subjectIds: string[]; assetIds?: string[] }

// The subjects the project does not hold yet, each once.
function makeSubjects(ctx: ProjectContext, plan: BriefPlan, createdAt: string): string[] {
  const ids: string[] = []
  for (const s of plan.subjects) {
    if (ids.includes(s.id)) continue
    ids.push(s.id)
    if (s.held) continue
    insertSubject(ctx, { id: s.id, name: s.name, description: s.description, createdAt })
  }
  return ids
}

export function campaignFromBrief(name: FromBriefName, deps: Pick<CoreDeps, 'now' | 'log'>) {
  const withFiles = name === 'campaign.createFromBriefWithFiles'
  return defineCommand({
    name,
    input: campaignFromBriefInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<PreparedImport | null> {
      const plan = briefPlan(ctx.project.db, input, withFiles)
      if (!withFiles) return null
      return logUnreadable(deps.log, { command: name, actor: ctx.actor }, () =>
        prepareFileImport(ctx.project, plan.paths),
      )
    },
    undoPrepare: (prepared) => (prepared ? removeCopies(prepared.copies) : undefined),
    run(ctx, input, prepared) {
      const now = deps.now().toISOString()
      const plan = briefPlan(ctx.project.db, input, withFiles)
      const fileIds = prepared ? insertImportedRows(ctx, prepared, 'asset', now) : []
      const subjectIds = makeSubjects(ctx, plan, now)
      attachPictures(ctx, plan.pictures, fileIds)
      const made = createCampaignRows(ctx, plan.create, now)
      const data: BriefCreated = {
        ...made,
        subjectIds,
        ...(withFiles ? { assetIds: fileIds } : {}),
      }
      return { data, log: { campaignId: made.campaignId, variantId: made.variantId } }
    },
  })
}
