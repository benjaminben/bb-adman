// The target line of an agent's ask (spec/phases/phase-10.md, ask flow, A-238): one line the
// permission dialog shows, read from the open project. It holds names only: no ID, no input
// value other than what the names say, no path. A target that cannot be found gives NO_TARGET,
// and the command then refuses as usual. Names come from a project file anyone may have made,
// so each is cleaned by the shared name cleaner.
import type Database from 'better-sqlite3'
import { z } from 'zod'
import type { PermissionRequest } from '@/main/commands/bus'
import { briefPlan, type BriefPlan } from '@/main/commands/campaign/from-brief-plan'
import type { ProjectRegistry } from '@/main/db/project-registry'
import type { CustomWorkflowStore } from '@/main/providers/comfyui/custom/store'
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import { cleanName } from './clean-name'

export const NO_TARGET = 'Something that no longer exists'

const campaignTarget = z.object({ campaignId: z.string() })
const variantTarget = z.object({ variantId: z.string() })
const subjectTarget = z.object({ subjectId: z.string() })
const filesTarget = z.object({ paths: z.array(z.string()) })
const workflowTarget = z.object({ workflowId: z.string() })

// CW-6a: where an app-scope ask finds a workflow's name.
export type WorkflowNames = Pick<CustomWorkflowStore, 'get' | 'checkAdd'>

// Read as stored: readMeta refuses a name an edited file may hold, and the ask must not fail.
function projectName(db: Database.Database): string {
  const row = db
    .prepare<[], { value: string }>("SELECT value FROM project_meta WHERE key = 'name'")
    .get()
  return cleanName(row?.value ?? '')
}

function campaignLine(db: Database.Database, campaignId: string): string | null {
  const row = db
    .prepare<[string, string], { name: string; n: number }>(
      `SELECT c.name AS name, (SELECT COUNT(*) FROM variant v JOIN direction d
         ON d.id = v.direction_id WHERE d.campaign_id = ?) AS n
       FROM campaign c WHERE c.id = ?`,
    )
    .get(campaignId, campaignId)
  if (!row) return null
  const count = row.n === 1 ? '1 variant' : `${row.n} variants`
  return `Campaign "${cleanName(row.name)}" (${count}) in "${projectName(db)}"`
}

function variantLine(db: Database.Database, variantId: string): string | null {
  const row = db
    .prepare<[string], { title: string; sizeLabel: string; language: string; campaign: string }>(
      `SELECT v.title AS title, v.size_label AS sizeLabel, v.language AS language,
         c.name AS campaign
       FROM variant v JOIN direction d ON d.id = v.direction_id
       JOIN campaign c ON c.id = d.campaign_id WHERE v.id = ?`,
    )
    .get(variantId)
  if (!row) return null
  const name = [row.title, row.sizeLabel, row.language].map(cleanName).join(' · ')
  return `Variant "${name}" in campaign "${cleanName(row.campaign)}" in "${projectName(db)}"`
}

// SUBJ-1: the subject's name and how many photos (pictures, as its card counts them) it holds;
// never a photo's name or path.
function subjectLine(db: Database.Database, subjectId: string): string | null {
  const row = db
    .prepare<[string, string], { name: string; n: number }>(
      `SELECT s.name AS name, (SELECT COUNT(*) FROM asset a
         WHERE a.subject_id = ? AND a.kind = 'image') AS n
       FROM subject s WHERE s.id = ?`,
    )
    .get(subjectId, subjectId)
  if (!row) return null
  const count = row.n === 0 ? 'no photos' : row.n === 1 ? '1 photo' : `${row.n} photos`
  return `Subject "${cleanName(row.name)}" (${count}) in "${projectName(db)}"`
}

const fileCount = (count: number) => (count === 1 ? '1 file' : `${count} files`)

// D7: the count only; the paths reach the dialog through agent.askFiles.
function filesLine(db: Database.Database, count: number): string {
  return `${fileCount(count)} into "${projectName(db)}"`
}

// R2P-7: the campaign's name as the brief gives it, and the count of its full paths. The
// broker checked the brief before this runs; one it cannot read gives NO_TARGET.
function briefLine(db: Database.Database, input: unknown): string | null {
  const parsed = campaignFromBriefInput.safeParse(input)
  if (!parsed.success) return null
  let plan: BriefPlan
  try {
    plan = briefPlan(db, parsed.data, true)
  } catch {
    return null
  }
  const name = cleanName(plan.create.brief.campaignName)
  const files = fileCount(plan.paths.length)
  return `Campaign "${name}" with ${files} for its subjects, in "${projectName(db)}"`
}

function lineFor(db: Database.Database, command: string, input: unknown): string | null {
  if (command === 'campaign.delete') {
    const parsed = campaignTarget.safeParse(input)
    return parsed.success ? campaignLine(db, parsed.data.campaignId) : null
  }
  if (command === 'variant.delete') {
    const parsed = variantTarget.safeParse(input)
    return parsed.success ? variantLine(db, parsed.data.variantId) : null
  }
  if (command === 'subject.delete') {
    const parsed = subjectTarget.safeParse(input)
    return parsed.success ? subjectLine(db, parsed.data.subjectId) : null
  }
  if (command === 'asset.importFiles') {
    const parsed = filesTarget.safeParse(input)
    return parsed.success ? filesLine(db, parsed.data.paths.length) : null
  }
  if (command === 'campaign.createFromBriefWithFiles') return briefLine(db, input)
  return null
}

// CW-6a: the removed workflow's stored name, cleaned; no project is named.
function workflowRemoveLine(workflows: WorkflowNames | undefined, input: unknown): string | null {
  const parsed = workflowTarget.safeParse(input)
  const entry = parsed.success ? workflows?.get(parsed.data.workflowId) : undefined
  return entry ? `Workflow "${cleanName(entry.stored.name)}"` : null
}

export function askTarget(
  projects: ProjectRegistry,
  request: PermissionRequest,
  workflows?: WorkflowNames,
): string {
  if (request.command === 'comfyWorkflow.remove') {
    return workflowRemoveLine(workflows, request.input) ?? NO_TARGET
  }
  const handle = request.projectId ? projects.get(request.projectId) : undefined
  if (!handle) return NO_TARGET
  return lineFor(handle.db, request.command, request.input) ?? NO_TARGET
}
