// Helpers for the SP-3 subject photo tests: the brief form rendered on its own over a fake api
// whose asset.list answers with a list the test can grow, and whose asset.import adds rows to
// it and sends project.changed, as the main process does.
import { vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import type { Result } from '@/shared/schemas/result'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { BriefForm } from '@/renderer/screens/project-home/brief-form'
import {
  formFromDraft,
  type BriefFormValues,
} from '@/renderer/screens/project-home/brief-form-model'
import { assetRow } from '../../editor/editor-fixture'
import { baseState, makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { DRAFT, PROJECT } from './project-fixture'

export const reply = (over: Partial<AssetImportReply> = {}): AssetImportReply => ({
  assetIds: [],
  reusedAssetIds: [],
  skippedCount: 0,
  animatedAssetIds: [],
  ...over,
})

export function photoApi(start: AssetList = []) {
  const fake = makeFakeApi(baseState({ openProjects: [PROJECT] }))
  let images = [...start]
  fake.onQuery('asset.list', () => ({ ok: true, data: images }))
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/p/a.png'] } }))
  const changed = () =>
    fake.emit('project.changed', { projectId: 'P1', changed: {}, removed: {}, actor: 'user' })
  const answerImport = (result: Result<AssetImportReply>, rows: AssetList = []) =>
    fake.onCommand('asset.import', () => {
      images = [...images, ...rows]
      if (rows.length > 0) changed()
      return result
    })
  answerImport({ ok: true, data: reply({ assetIds: ['N1'] }) }, [
    assetRow('N1', { displayName: 'a.png' }),
  ])
  return { ...fake, answerImport, changed, setImages: (next: AssetList) => (images = next) }
}

export type PhotoFake = ReturnType<typeof photoApi>

// A form with one subject row, everything else filled, so only photo lines block Create.
export function oneRowForm(over: Partial<BriefFormValues> = {}): BriefFormValues {
  const values = formFromDraft(
    { draft: { ...DRAFT, subjects: [{ name: 'Can' }] }, primaryLanguage: 'en' },
    [],
  )
  return { ...values, ...over }
}

export async function renderForm(
  fake: PhotoFake,
  initial: BriefFormValues = oneRowForm(),
  subjects: SubjectRow[] = [],
) {
  const onCreate = vi.fn()
  const view = await renderApp(
    <BriefForm
      projectId="P1"
      initial={initial}
      subjects={subjects}
      campaigns={[]}
      creating={false}
      onCreate={onCreate}
      onCancel={vi.fn()}
    />,
    fake,
  )
  const form = await screen.findByRole('region', { name: 'Brief' })
  await act(async () => {})
  return { ...view, form, onCreate }
}

export const subjectRow = (form: HTMLElement, n: number) =>
  within(form).getByRole('group', { name: `Subject ${n}` })

export const photosOf = (form: HTMLElement, n: number) =>
  within(subjectRow(form, n)).getByRole('group', { name: 'Photos' })

export const sentNames = (fake: PhotoFake) => fake.commands.map((c) => c.name)
