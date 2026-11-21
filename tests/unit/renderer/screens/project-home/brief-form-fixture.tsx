// Helpers for the S2-14 brief form tests: open the form from a loaded brief, read its problem
// lines, and press "Create campaign" to see what campaign.create got. SP-3: the fake answers
// asset.list, the picture picker and asset.import, so addPhoto(form, n) gives row n a photo,
// and loadForm gives every row one unless told not to.
import { expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { assetRow } from '../../editor/editor-fixture'
import { DRAFT, PROJECT, projectApi, projectGet } from './project-fixture'

export type Fake = ReturnType<typeof projectApi>

// projectApi with the photo stubs: each "Add photos" picks one new picture, F1, F2 and so on;
// asset.import adds it to the project's pictures and sends project.changed.
export function photoStubs(fake: ReturnType<typeof projectApi>) {
  const images: AssetList = []
  const brief = { ok: true as const, data: { paths: ['/b/brief.yaml'] } }
  let picked = 0
  fake.onQuery('asset.list', () => ({ ok: true, data: images }))
  fake.onQuery('dialog.pickFiles', (input) => {
    if ((input as { kind?: string }).kind !== 'image') return brief
    picked += 1
    return { ok: true, data: { paths: [`/p/F${picked}.png`] } }
  })
  fake.onCommand('asset.import', (input) => {
    const id = (input as { paths: string[] }).paths[0]?.replace(/^\/p\/|\.png$/g, '') ?? ''
    images.push(assetRow(id))
    fake.emit('project.changed', {
      projectId: PROJECT.projectId,
      changed: {},
      removed: {},
      actor: 'user',
    })
    return {
      ok: true,
      data: { assetIds: [id], reusedAssetIds: [], skippedCount: 0, animatedAssetIds: [] },
    }
  })
  return fake
}

// Presses "Add photos" in row n and waits until the photo shows.
export async function addPhoto(form: HTMLElement, n: number) {
  const row = within(form).getByRole('group', { name: `Subject ${n}` })
  const before = within(row).queryAllByRole('button', { name: /^Remove photo / }).length
  await userEvent.click(within(row).getByRole('button', { name: `Add photos to subject ${n}` }))
  await waitFor(() =>
    expect(within(row).queryAllByRole('button', { name: /^Remove photo / })).toHaveLength(
      before + 1,
    ),
  )
}

export async function addPhotos(form: HTMLElement) {
  const rows = within(form).getAllByRole('group', { name: /^Subject \d+$/ })
  for (let n = 1; n <= rows.length; n += 1) await addPhoto(form, n)
}

export async function loadForm(
  reply: ProjectGet = projectGet(),
  draft: BriefDraft = DRAFT,
  photos = true,
) {
  const fake = photoStubs(projectApi(reply, draft))
  await renderApp(<ProjectHome project={PROJECT} />, fake)
  await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
  const form = await screen.findByRole('region', { name: 'Brief' })
  if (photos) await addPhotos(form)
  return { fake, form }
}

export function problemLines(form: HTMLElement): (string | null)[] {
  const list = within(form).queryByRole('list', { name: 'Before the campaign can be made' })
  if (list === null) return []
  return within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent)
}

export async function createdInput(fake: Fake): Promise<CampaignCreateInput> {
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
  await waitFor(() => expect(fake.commands.map((c) => c.name)).toContain('campaign.create'))
  return fake.commands.find((c) => c.name === 'campaign.create')?.input as CampaignCreateInput
}

export async function retype(field: HTMLElement, text: string) {
  await userEvent.clear(field)
  if (text !== '') await userEvent.type(field, text)
}
