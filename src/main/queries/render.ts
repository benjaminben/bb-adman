// The render query domain (spec/editor-commands.md, "thumbnail.get" and "variant.render").
// Both go to the render service; neither writes project data.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { thumbnailGetInput, variantRenderInput } from '@/shared/schemas/queries/render'
import { AppError } from '@/shared/schemas/result'

export const THUMBNAIL_DENIED =
  'Agents cannot read thumbnails in this version. Ask the user to do it in the app.'

function invalid(): AppError {
  return new AppError('INVALID_INPUT', 'Some values are not valid.')
}

// User only in Phase 3: no MCP tool wraps it.
function thumbnailGet(deps: Pick<CoreDeps, 'projects' | 'render'>): QueryFn {
  return async (raw, opts) => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', THUMBNAIL_DENIED)
    const parsed = thumbnailGetInput.safeParse(raw)
    if (!parsed.success) throw invalid()
    const project = deps.projects.requireOpen(parsed.data.projectId)
    return deps.render.thumbnail(project, parsed.data.variantId)
  }
}

// Both actors. The user's draw reports overflow as it always has. The agent's draw is the
// complete ad, linked pictures outside the project's folder included (P10-3, A-234,
// stakeholder ruling), and changes nothing; the MCP tool sends back its PNG bytes only.
function variantRender(deps: Pick<CoreDeps, 'projects' | 'render'>): QueryFn {
  return async (raw, opts) => {
    const parsed = variantRenderInput.safeParse(raw)
    if (!parsed.success) throw invalid()
    const { projectId, variantId, maxDimension, timeMs } = parsed.data
    const project = deps.projects.requireOpen(projectId)
    if (opts.actor === 'user') return deps.render.render(project, variantId, maxDimension, timeMs)
    return deps.render.renderForAgent(project, variantId, maxDimension, timeMs)
  }
}

export function renderQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'thumbnail.get': thumbnailGet(deps), 'variant.render': variantRender(deps) }
}
