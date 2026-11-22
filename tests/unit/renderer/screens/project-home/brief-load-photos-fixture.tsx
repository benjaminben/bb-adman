// Helpers for the SP-4 tests: a project page whose brief.parse names one checked photo per
// subject, whose asset.import adds the pictures to the project (B1 for the first path, B2 for
// the second, F1 for the picker's "Add photos" file), whose asset.update attaches them and whose
// subject.create adds the subject, each sending project.changed as the main process does.
import { expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SubjectPictures } from '@/shared/schemas/commands/brief'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { renderApp } from '../../render'
import { assetRow } from '../../editor/editor-fixture'
import { DRAFT, PROJECT, projectApi, projectGet, subject } from './project-fixture'

export const PATHS = ['/b/photos/can.png', '/b/bottle.png'] as const
const IDS: Record<string, string> = { [PATHS[0]]: 'B1', [PATHS[1]]: 'B2', '/p/F1.png': 'F1' }
const PICTURES: SubjectPictures[] = PATHS.map((path) => ({
  paths: [path],
  assetIds: [],
  notes: [],
}))

export function briefApi(pictures: SubjectPictures[] = PICTURES) {
  const base = projectApi()
  const images: AssetList = []
  const refused = new Map<string, string>()
  const reused = new Set<string>()
  const refusedUpdates = new Set<string>()
  const reply = projectGet()
  let gate: Promise<void> | null = null
  const changed = () =>
    base.emit('project.changed', { projectId: 'P1', changed: {}, removed: {}, actor: 'user' })
  base.onCommand('brief.parse', () => ({
    ok: true,
    data: { draft: DRAFT, primaryLanguage: 'en', subjectPictures: pictures },
  }))
  base.onQuery('project.get', () => ({
    ok: true,
    data: { ...reply, subjects: [...reply.subjects] },
  }))
  base.onQuery('dialog.pickFiles', (input) => {
    const image = (input as { kind?: string }).kind === 'image'
    return { ok: true, data: { paths: [image ? '/p/F1.png' : '/b/brief.yaml'] } }
  })
  base.onCommand('subject.create', (input) => {
    const { id, name } = input as { id: string; name: string }
    reply.subjects.push(subject(id, name))
    changed()
    return { ok: true, data: null }
  })
  base.onQuery('asset.list', () => ({ ok: true, data: images.map((row) => ({ ...row })) }))
  base.onCommand('asset.import', async (input) => {
    const { paths } = input as { paths: string[] }
    if (gate) await gate
    const message = refused.get(paths[0] ?? '')
    if (message !== undefined) {
      const details = { reason: 'assets_folder_missing' }
      return { ok: false, error: { code: 'RULE_VIOLATION', message, details } }
    }
    const ids = paths.map((path) => IDS[path] ?? path)
    const names = paths.map((path) => path.split('/').pop() ?? '')
    images.push(...ids.map((id, i) => assetRow(id, { displayName: names[i] })))
    changed()
    const reusedAssetIds = ids.filter((id) => reused.has(id))
    return {
      ok: true,
      data: { assetIds: ids, reusedAssetIds, skippedCount: 0, animatedAssetIds: [] },
    }
  })
  base.onCommand('asset.update', (input) => {
    const { assetId, subjectId } = input as { assetId: string; subjectId: string }
    if (refusedUpdates.has(assetId)) {
      const message = 'That subject is not in this project.'
      return { ok: false, error: { code: 'NOT_FOUND', message } }
    }
    const row = images.find((r) => r.id === assetId)
    if (row) row.subjectId = subjectId
    changed()
    return { ok: true, data: null }
  })
  const fake = Object.assign(base, {
    refuseImport: (path: string, message: string) => refused.set(path, message),
    reuse: (id: string) => reused.add(id),
    refuseUpdate: (id: string, refuse = true) =>
      refuse ? refusedUpdates.add(id) : refusedUpdates.delete(id),
  })
  // Holds every asset.import until the returned function is called.
  const hold = () => {
    let open = () => {}
    gate = new Promise((resolve) => (open = resolve))
    return () => open()
  }
  return { fake, hold }
}

export type BriefFake = ReturnType<typeof briefApi>['fake']

export const sent = (fake: BriefFake, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

export const imports = (fake: BriefFake) =>
  sent(fake, 'asset.import') as { projectId: string; paths: string[] }[]

export async function openPage(fake: BriefFake) {
  const view = await renderApp(
    <>
      <ErrorBanner />
      <ProjectHome project={PROJECT} />
    </>,
    fake,
  )
  await screen.findByText('No campaign yet.')
  return view
}

export async function openForm(fake: BriefFake) {
  await openPage(fake)
  await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
  const form = await screen.findByRole('region', { name: 'Brief' })
  await waitFor(() => expect(within(form).queryByText(/pictures are still being read/)).toBeNull())
  return form
}

// The names of the form photos row n shows, from their "Remove" buttons.
export function photoNames(form: HTMLElement, n: number): string[] {
  const row = within(form).getByRole('group', { name: `Subject ${n}` })
  return within(row)
    .queryAllByRole('button', { name: /^Remove photo / })
    .map(
      (b) =>
        b.getAttribute('aria-label')?.replace(/^Remove photo (.*) from subject \d+$/, '$1') ?? '',
    )
}
