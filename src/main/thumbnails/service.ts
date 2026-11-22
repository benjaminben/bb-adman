// spec/scene.md, "The render service" and "Thumbnails": draws variants one at a time through
// the queue, keeps the thumbnail files, reports overflow after every draw and cleans a
// project's old thumbnails when it closes. No Electron: the draw is handed in.
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { AppError } from '@/shared/schemas/result'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { ThumbnailGet, VariantRender } from '@/shared/schemas/queries/render'
import { cleanThumbnails, readThumbnail, writeThumbnail } from './cache'
import { createEagerThumbnails } from './eager'
import { drawFullWith } from './full-draw'
import { fitSize, thumbnailName, thumbnailSize } from './paths'
import { createDrawQueue } from './queue'
import { sceneInput, type VariantScene } from './scene-input'
import type { DrawResult, RenderService, RenderServiceOptions } from './types'

const NOT_FOUND = 'That variant was not found.'
type WarnIds = { projectId: string; variantId?: string }

const RENDER_FAILED = 'The picture could not be drawn. Try again.'

// The draw says why it failed through a reason property; anything else is an error.
function failureReason(e: unknown): 'timeout' | 'crashed' | 'error' {
  const reason = typeof e === 'object' && e !== null && 'reason' in e ? e.reason : null
  return reason === 'timeout' || reason === 'crashed' ? reason : 'error'
}

function safeName(variantId: string, rev: number): string | null {
  try {
    return thumbnailName(variantId, rev)
  } catch {
    return null
  }
}

export function createRenderService(opts: RenderServiceOptions): RenderService {
  const queue = createDrawQueue()
  // The rev whose thumbnail draw failed, by project and variant, until the rev changes.
  const failed = new Map<string, number>()
  const keyOf = (projectId: string, variantId: string) => `${projectId}/${variantId}`
  const userData = () => opts.deps().userDataDir
  const changed = (projectId: string, variantId: string) =>
    opts.emit({ name: 'thumbnail.changed', payload: { projectId, variantId } })

  // One warn line with IDs and a reason only: no path, no copy text, no error text. A log that
  // cannot be written never stops a draw or a close.
  function warn(name: string, message: string, ids: WarnIds, reason?: string): void {
    const context = reason ? { reason } : {}
    const line = { level: 'warn', event: 'app', actor: 'system', ok: false } as const
    try {
      opts.deps().log.write({ ...line, name, message, ...ids, context })
    } catch {
      return
    }
  }

  async function drawOnce(
    scene: VariantScene,
    variantId: string,
    size: { width: number; height: number },
  ): Promise<DrawResult | null> {
    try {
      return await opts.draw(scene.input, size)
    } catch (e) {
      warn(
        'render.draw',
        'A picture of a variant could not be drawn.',
        { projectId: scene.input.projectId, variantId },
        failureReason(e),
      )
      return null
    }
  }

  // Sends layer.reportOverflow for each text layer whose measured overflow differs.
  async function reportOverflow(scene: VariantScene, overflow: Record<string, boolean>) {
    for (const layer of scene.input.layers) {
      const measured = overflow[layer.id]
      if (layer.type !== 'text' || typeof measured !== 'boolean' || measured === layer.overflow) {
        continue
      }
      const input = {
        projectId: scene.input.projectId,
        layerId: layer.id,
        overflow: measured,
        variantRev: scene.rev,
      }
      await opts.bus().execute('layer.reportOverflow', input, { actor: 'user' })
    }
  }

  async function drawThumbnail(projectId: string, variantId: string): Promise<void> {
    const project = opts.deps().projects.get(projectId)
    if (!project) return
    const scene = await sceneInput(opts.deps(), project, variantId, { timeMs: 'poster' })
    const key = keyOf(projectId, variantId)
    if (!scene || failed.get(key) === scene.rev) return
    if (await readThumbnail(userData(), projectId, variantId, scene.rev)) return
    const result = await drawOnce(scene, variantId, thumbnailSize(scene.input.variant))
    if (!result) {
      failed.set(key, scene.rev)
      changed(projectId, variantId)
      return
    }
    await reportOverflow(scene, result.overflow)
    if (opts.deps().projects.get(projectId) !== project) return
    const outcome = await writeThumbnail(
      userData(),
      projectId,
      variantId,
      scene.rev,
      result.png,
    ).catch(() => 'error' as const)
    if (outcome === 'refused' || outcome === 'error') {
      failed.set(key, scene.rev)
      warn('render.thumbnail', 'A thumbnail could not be saved.', { projectId, variantId }, outcome)
    }
    changed(projectId, variantId)
  }

  const requestThumbnail = (projectId: string, variantId: string) =>
    queue.thumbnail(projectId, variantId, () => drawThumbnail(projectId, variantId))

  const eager = createEagerThumbnails({
    deps: opts.deps,
    queue,
    request: requestThumbnail,
    filesChanged: (projectId, variantId) => {
      failed.delete(keyOf(projectId, variantId))
      changed(projectId, variantId)
    },
  })

  function variantOf(project: ProjectHandle, variantId: string): VariantRow {
    const variant = readWireRow(project.db, 'variant', { id: variantId }) as VariantRow | null
    if (!variant) throw new AppError('NOT_FOUND', NOT_FOUND)
    return variant
  }

  // A variant.render draw, the agent's (no overflow report) or the layout job's picture (no
  // text, so no overflow to report).
  async function drawVariant(
    project: ProjectHandle,
    variantId: string,
    maxDimension: number,
    how: { withoutText?: boolean; backgroundOnly?: boolean; report: boolean; timeMs?: number },
  ): Promise<VariantRender> {
    const { withoutText, backgroundOnly, timeMs } = how
    const open = opts.deps().projects.requireOpen(project.projectId)
    const which = { withoutText, backgroundOnly, timeMs }
    const scene = await sceneInput(opts.deps(), open, variantId, which)
    if (!scene) throw new AppError('NOT_FOUND', NOT_FOUND)
    const v = scene.input.variant
    const size = fitSize(v, Math.min(maxDimension, Math.max(v.width, v.height)))
    const result = await drawOnce(scene, variantId, size)
    if (!result) throw new AppError('RULE_VIOLATION', RENDER_FAILED, { reason: 'render_failed' })
    if (how.report) await reportOverflow(scene, result.overflow)
    return { png: result.png, width: size.width, height: size.height, rev: scene.rev }
  }

  return {
    async thumbnail(project, variantId): Promise<ThumbnailGet> {
      const { rev } = variantOf(project, variantId)
      eager.noteRev(project, variantId, rev)
      if (failed.get(keyOf(project.projectId, variantId)) === rev) return { state: 'failed', rev }
      const png = await readThumbnail(userData(), project.projectId, variantId, rev).catch(
        () => 'bad' as const,
      )
      if (png === 'bad') return { state: 'failed', rev }
      if (png) return { state: 'ready', rev, png }
      requestThumbnail(project.projectId, variantId)
      return { state: 'pending', rev }
    },

    render(project, variantId, maxDimension, timeMs) {
      return queue.render(() =>
        drawVariant(project, variantId, maxDimension, { report: true, timeMs }),
      )
    },

    renderForAgent(project, variantId, maxDimension, timeMs) {
      return queue.render(() =>
        drawVariant(project, variantId, maxDimension, { report: false, timeMs }),
      )
    },

    renderPictures(project, variantId, maxDimension) {
      const how = { withoutText: true, report: false }
      return queue.render(() => drawVariant(project, variantId, maxDimension, how))
    },

    renderBackground(project, variantId, size) {
      const how = { backgroundOnly: true, report: false, timeMs: 0 }
      const longSide = Math.max(size.width, size.height)
      return queue.render(async () => {
        const drawn = await drawVariant(project, variantId, longSide, how)
        return drawn.png
      })
    },

    drawFull: drawFullWith(queue, opts.draw, () => opts.deps().exportPictures),

    onEvent(event) {
      eager.onEvent(event)
    },

    async projectClosed(projectId) {
      try {
        const known = eager.projectClosed(projectId)
        if (!known) return
        const keep = new Set<string>()
        for (const [variantId, rev] of known) {
          const name = safeName(variantId, rev)
          if (name) keep.add(name)
        }
        await cleanThumbnails(userData(), projectId, keep)
      } catch {
        warn('render.clean', 'Old thumbnails could not be cleaned up.', { projectId })
      }
    },
  }
}
