// Allow-list pickers for list_subjects and get_variant (spec/phases/phase-10.md, A-235, A-249).
// Each names every field it passes on, at every depth, so a field added to a row later (a path,
// say) cannot leave through MCP without a change here (FR-198). An asset's stored path, hash,
// MIME type, size, file time and prompt are never named.
import type { SubjectList } from '@/shared/schemas/queries/subject'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { AnimationBlock, Geometry, Revs, Shade } from '@/shared/schemas/layer'
import type { ImageStyle, TextStyle } from '@/shared/schemas/layer'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { ReplyPicker } from './read-replies'

// Drops the keys whose value is undefined, so an absent look field stays absent.
const defined = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

export const subjectListFields: ReplyPicker = (data) =>
  (data as SubjectList).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    assetIds: [...s.assetIds],
  }))

// The variant as get_campaign gives it (project-replies.ts), named here again.
const variant = (v: VariantSummary) => ({
  id: v.id,
  directionId: v.directionId,
  title: v.title,
  width: v.width,
  height: v.height,
  sizeLabel: v.sizeLabel,
  language: v.language,
  format: v.format,
  durationMs: v.durationMs,
  durationOverridden: v.durationOverridden,
  rev: v.rev,
  createdBy: v.createdBy,
  createdAt: v.createdAt,
  agentChangedAt: v.agentChangedAt,
  firstClipMade: v.firstClipMade,
  sound: v.sound,
  soundAssetId: v.soundAssetId,
  isMaster: v.isMaster,
  subjectIds: [...v.subjectIds],
  badges: {
    jobRunning: v.badges.jobRunning,
    resultUnseen: v.badges.resultUnseen,
    outOfDate: v.badges.outOfDate,
    overflow: v.badges.overflow,
    translationUnapproved: v.badges.translationUnapproved,
    checkWarning: v.badges.checkWarning,
    checkStale: v.badges.checkStale,
    missingFile: v.badges.missingFile,
  },
})

const box = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x,
  y: b.y,
  width: b.width,
  height: b.height,
})

const geometry = (g: Geometry) => ({
  ...box(g),
  rotation: g.rotation,
  crop: g.crop ? box(g.crop) : null,
})

const textStyle = (s: TextStyle) =>
  defined({
    fontAssetId: s.fontAssetId,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.color,
    align: s.align,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    verticalAlign: s.verticalAlign,
    allCaps: s.allCaps,
    boxColor: s.boxColor,
    boxOutlineColor: s.boxOutlineColor,
    boxOutlineWidth: s.boxOutlineWidth,
    boxRadius: s.boxRadius,
    boxPadding: s.boxPadding,
  })

const shade = (s: Shade) => ({ color: s.color, from: s.from, strength: s.strength, reach: s.reach })

const imageStyle = (s: ImageStyle) =>
  defined({
    opacity: s.opacity,
    fillColor: s.fillColor,
    shade: s.shade ? shade(s.shade) : s.shade,
  })

const style = (s: TextStyle | ImageStyle) =>
  'fontSize' in s ? textStyle(s) : imageStyle(s as ImageStyle)

const animationBlock = (a: AnimationBlock) => ({
  preset: a.preset,
  startMs: a.startMs,
  durationMs: a.durationMs,
})

const revs = (r: Revs) => ({
  copy: r.copy,
  style: r.style,
  geometry: r.geometry,
  source: r.source,
  timing: r.timing,
  animation: r.animation,
})

const layer = (l: LayerRow) => ({
  id: l.id,
  variantId: l.variantId,
  key: l.key,
  type: l.type,
  slot: l.slot,
  name: l.name,
  z: l.z,
  visible: l.visible,
  locked: l.locked,
  linked: l.linked,
  overrides: [...l.overrides],
  copy: l.copy,
  style: style(l.style),
  geometry: geometry(l.geometry),
  source: l.source ? { assetId: l.source.assetId } : null,
  timing: { startMs: l.timing.startMs, endMs: l.timing.endMs },
  animation: {
    entrance: animationBlock(l.animation.entrance),
    exit: animationBlock(l.animation.exit),
  },
  revs: revs(l.revs),
  syncedRevs: revs(l.syncedRevs),
  translationStatus: l.translationStatus,
  translationSource: l.translationSource,
  overflow: l.overflow,
})

const asset = (a: AssetRow & { missing: boolean }) => ({
  id: a.id,
  displayName: a.displayName,
  kind: a.kind,
  library: a.library,
  subjectId: a.subjectId,
  width: a.width,
  height: a.height,
  durationMs: a.durationMs,
  fontFamily: a.fontFamily,
  missing: a.missing,
})

export const variantFields: ReplyPicker = (data) => {
  const v = data as VariantGet
  return {
    variant: variant(v.variant),
    campaignId: v.campaignId,
    layers: v.layers.map(layer),
    assets: v.assets.map(asset),
  }
}
