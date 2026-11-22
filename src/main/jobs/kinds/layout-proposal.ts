// The layout_proposal job kind (spec/ai-jobs.md "Layout proposal"; FR-061). It reads the
// variant when it runs, draws it without its text, makes one layout call and keeps the boxes
// clampLayout leaves. It writes nothing to the variant: the window applies the boxes with one
// layer.updateMany. It is an attached kind, so the runner ends a cancelled one at once and
// keeps no result, whatever the call answers after. R2E-2 (spec/phases/round-2-editor.md D2):
// after the clamp, each box is checked against the same picture so its text can be read.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { LocalFailure } from '@/main/jobs/local-failure'
import { runOptions } from '@/main/jobs/progress'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderCancelled, ProviderFailure, type LayoutProvider } from '@/main/providers/types'
import { variantLayers } from '@/main/thumbnails/scene-input'
import type { Pixels } from '@/shared/generation/contrast'
import { clampLayout } from '@/shared/generation/layout-clamp'
import { keepReadable } from '@/shared/generation/layout-readable'
import type { LayoutJobResult } from '@/shared/schemas/jobs/layout-proposal'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import type { VariantRow } from '@/shared/schemas/rows/variant'

// The longest side of the picture sent with a layout call.
export const LAYOUT_PICTURE_SIDE = 1024

export type LayoutAdapterFor = (deps: CoreDeps, providerId: string) => LayoutProvider

// What the provider places: each visible text layer with copy, in the order given (z order).
export function layoutItems(layers: LayerRow[]): Array<{ slot: string; text: string }> {
  return layers
    .filter((l) => l.type === 'text' && l.visible && (l.copy ?? '').trim() !== '')
    .map((l) => ({ slot: l.key, text: l.copy ?? '' }))
}

function palette(project: ProjectHandle, campaignId: string | null): string[] {
  if (!campaignId) return []
  const rules = readWireRow(project.db, 'rule_set', { campaignId }) as RuleSetRow | null
  return rules ? [...rules.palette] : []
}

// "Inter" and the family name of each font a text layer uses, once each.
function fonts(project: ProjectHandle, layers: LayerRow[]): string[] {
  const names = new Set(['Inter'])
  for (const layer of layers) {
    const fontId = layer.type === 'text' && 'fontAssetId' in layer.style && layer.style.fontAssetId
    if (!fontId) continue
    const asset = readWireRow(project.db, 'asset', { id: fontId }) as AssetRow | null
    if (asset?.fontFamily) names.add(asset.fontFamily)
  }
  return [...names]
}

// The drawn picture's pixels, or null when they cannot be read: then the check is skipped
// with one warn line that holds no picture data, no path and no text from the ad.
function pixelsOf(jc: JobRunContext, job: JobRow, png: Uint8Array): Pixels | null {
  try {
    const pixels = jc.deps.readPixels(png)
    if (pixels.width > 0 && pixels.height > 0) return pixels
  } catch {
    // Falls through to the warn line below.
  }
  jc.deps.log.write({
    level: 'warn',
    event: 'job',
    name: 'layout.contrast',
    actor: 'system',
    ok: false,
    errorKind: 'pixels_unreadable',
    message: 'The picture could not be read, so the text colours were not checked.',
    projectId: jc.projectId,
    variantId: job.variantId,
    jobId: job.id,
  })
  return null
}

async function runLayoutJob(
  jc: JobRunContext,
  job: JobRow,
  layoutFor: LayoutAdapterFor,
): Promise<LayoutJobResult> {
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'place text with AI')
  const variantId = job.variantId ?? ''
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) throw new LocalFailure('target_gone')
  const picture = await jc.deps.render.renderPictures(project, variantId, LAYOUT_PICTURE_SIDE)
  const layers = variantLayers(project, variantId)
  const items = layoutItems(layers)
  const input = {
    background: { bytes: picture.png, mime: 'image/png' },
    width: variant.width,
    height: variant.height,
    items,
    palette: palette(project, job.campaignId),
    fonts: fonts(project, layers),
  }
  const provider = layoutFor(jc.deps, providerId)
  const answer = await jc.call(() => provider.propose(input, runOptions(jc)))
  const keys = items.map((item) => item.slot)
  const boxes = clampLayout(answer, { ...input, keys })
  if (boxes.length === 0) {
    throw new ProviderFailure({ kind: 'other', detail: 'No usable layout in the answer' })
  }
  const pixels = pixelsOf(jc, job, picture.png)
  if (!pixels) return { boxes }
  const scale = pixels.width / variant.width
  return { boxes: keepReadable(boxes, { pixels, scale, palette: input.palette, layers }) }
}

const defaultLayoutFor: LayoutAdapterFor = (deps, providerId) =>
  adapterFor(deps, providerId, 'layout')

export function layoutProposalKind(layoutFor: LayoutAdapterFor = defaultLayoutFor): JobKindHandler {
  return { kind: 'layout_proposal', run: (jc, job) => runLayoutJob(jc, job, layoutFor) }
}
