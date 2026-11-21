// The one place a command bumps variant.rev (FR-239). When the agent made the change it also
// stamps variant.agent_changed_at, so the window can show what the agent changed. Every
// command that bumps variant.rev calls this inside its transaction.
import type { ProjectContext } from '@/main/commands/types'

export function bumpVariantRev(ctx: ProjectContext, variantId: string, now: string): void {
  const agentTime = ctx.actor === 'agent' ? now : null
  ctx.project.db
    .prepare(
      `UPDATE variant SET rev = rev + 1, agent_changed_at = COALESCE(?, agent_changed_at)
       WHERE id = ?`,
    )
    .run(agentTime, variantId)
  ctx.changes.touch('variant', { id: variantId })
}
