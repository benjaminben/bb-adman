// Helpers for the BB-7 tests: a project page whose brief.parse names one photo per subject and
// the given brand values and brand files. asset.import gives the photos B1 and B2 and each brand
// path its own ID (L1 for the logo, FH and FB for the two fonts), adds the row to the project's
// assets with the right kind and sends project.changed. asset.list answers by kind.
import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { BrandFiles, SubjectPictures } from '@/shared/schemas/commands/brief'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { renderApp } from '../../render'
import { assetRow } from '../../editor/editor-fixture'
import { DRAFT, PROJECT, projectApi } from './project-fixture'

export const LOGO = '/w/kit/secret-folder/mark.png'
export const HEADING = '/w/kit/secret-folder/Display.woff2'
export const BODY = '/w/kit/secret-folder/Text.ttf'
const PHOTOS = ['/w/photos/can.png', '/w/photos/bottle.png']
const IDS: Record<string, string> = {
  [PHOTOS[0] ?? '']: 'B1',
  [PHOTOS[1] ?? '']: 'B2',
  [LOGO]: 'L1',
  [HEADING]: 'FH',
  [BODY]: 'FB',
}
const FAMILIES: Record<string, string | null> = { FH: 'Display Sans', FB: null }

export const ALL_FILES: BrandFiles = {
  files: [
    { role: 'logo', path: LOGO, assetId: null },
    { role: 'headingFont', path: HEADING, assetId: null },
    { role: 'bodyFont', path: BODY, assetId: null },
  ],
  notes: [],
}

export type BrandBrief = {
  draft?: Partial<BriefDraft>
  brandFiles?: BrandFiles
  subjects?: number // how many of DRAFT's two subjects the brief keeps
}

export function brandApi(brief: BrandBrief = {}) {
  const fake = projectApi()
  const rows: AssetList = []
  const refused = new Map<string, string>()
  const reused = new Set<string>()
  let gate: Promise<void> | null = null
  const count = brief.subjects ?? 2
  const draft: BriefDraft = {
    ...DRAFT,
    subjects: DRAFT.subjects?.slice(0, count),
    ...brief.draft,
  }
  const pictures: SubjectPictures[] = PHOTOS.slice(0, count).map((path) => ({
    paths: [path],
    assetIds: [],
    notes: [],
  }))
  fake.onCommand('brief.parse', () => ({
    ok: true,
    data: { draft, primaryLanguage: 'en', subjectPictures: pictures, brandFiles: brief.brandFiles },
  }))
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/w/brief.yaml'] } }))
  fake.onQuery('asset.list', (input) => {
    const kind = (input as { kind?: string }).kind
    return { ok: true, data: rows.filter((r) => kind === undefined || r.kind === kind) }
  })
  fake.onCommand('asset.import', async (input) => {
    const { paths } = input as { paths: string[] }
    if (gate) await gate
    const message = refused.get(paths[0] ?? '')
    if (message !== undefined)
      return { ok: false, error: { code: 'RULE_VIOLATION', message, details: {} } }
    const ids = paths.map((path) => IDS[path] ?? 'X')
    ids.forEach((id, i) => {
      const font = id in FAMILIES
      const displayName = paths[i]?.split('/').pop() ?? ''
      const over = font ? { kind: 'font' as const, fontFamily: FAMILIES[id] ?? null } : {}
      rows.push(assetRow(id, { displayName, ...over }))
    })
    fake.emit('project.changed', { projectId: 'P1', changed: {}, removed: {}, actor: 'user' })
    const reusedAssetIds = ids.filter((id) => reused.has(id))
    return {
      ok: true,
      data: { assetIds: ids, reusedAssetIds, skippedCount: 0, animatedAssetIds: [] },
    }
  })
  fake.onCommand('asset.update', () => ({ ok: true, data: null }))
  fake.onCommand('subject.create', () => ({ ok: true, data: null }))
  const hold = () => {
    let open = () => {}
    gate = new Promise((resolve) => (open = resolve))
    return () => open()
  }
  return Object.assign(fake, {
    rows,
    hold,
    refuseImport: (path: string, message: string) => refused.set(path, message),
    reuse: (id: string) => reused.add(id),
  })
}

export type BrandFake = ReturnType<typeof brandApi>

export const sentTo = (fake: BrandFake, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

export const removedIds = (fake: BrandFake) =>
  sentTo(fake, 'asset.remove').map((i) => (i as { assetId: string }).assetId)

export async function openBrandPage(fake: BrandFake) {
  const view = await renderApp(
    <>
      <ErrorBanner />
      <ProjectHome project={PROJECT} />
    </>,
    fake,
  )
  await screen.findByText('No campaigns yet')
  return view
}

export async function openBrandForm(fake: BrandFake) {
  const view = await openBrandPage(fake)
  await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
  const form = await screen.findByRole('region', { name: 'New campaign' })
  return { view, form }
}

// The "Brand and layout" Section of the form.
export function brandSection(form: HTMLElement): HTMLElement {
  return within(form).getByRole('region', { name: 'Brand and layout' })
}

export function brandToggle(form: HTMLElement): HTMLElement {
  return within(form).getByRole('button', { name: 'Brand and layout' })
}

export async function waitForCreate() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled())
}
