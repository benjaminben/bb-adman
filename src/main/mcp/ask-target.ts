// The target line of an agent's ask (spec/phases/phase-10.md, ask flow, A-238): one line the
// permission dialog shows, read from the open project. It holds names only: no ID, no input
// value other than what the names say, no path. A target that cannot be found gives NO_TARGET,
// and the command then refuses as usual.
import type Database from 'better-sqlite3'
import { z } from 'zod'
import type { PermissionRequest } from '@/main/commands/bus'
import type { ProjectRegistry } from '@/main/db/project-registry'

export const NO_TARGET = 'Something that no longer exists'

const campaignTarget = z.object({ campaignId: z.string() })
const variantTarget = z.object({ variantId: z.string() })

// Names are the user's text: control, line-break and reordering characters are taken out so
// one name cannot change how the rest of the line reads.
function clean(name: string): string {
  return name.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim()
}

// Read as stored: readMeta refuses a name an edited file may hold, and the ask must not fail.
function projectName(db: Database.Database): string {
  const row = db
    .prepare<[], { value: string }>("SELECT value FROM project_meta WHERE key = 'name'")
    .get()
  return clean(row?.value ?? '')
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
  return `Campaign "${clean(row.name)}" (${row.n} variants) in "${projectName(db)}"`
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
  const name = [row.title, row.sizeLabel, row.language].map(clean).join(' · ')
  return `Variant "${name}" in campaign "${clean(row.campaign)}"`
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
  return null
}

export function askTarget(projects: ProjectRegistry, request: PermissionRequest): string {
  const handle = request.projectId ? projects.get(request.projectId) : undefined
  if (!handle) return NO_TARGET
  return lineFor(handle.db, request.command, request.input) ?? NO_TARGET
}
