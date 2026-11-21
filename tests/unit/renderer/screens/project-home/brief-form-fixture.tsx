// Helpers for the S2-14 brief form tests: open the form from a loaded brief, read its problem
// lines, and press "Create campaign" to see what campaign.create got.
import { expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { DRAFT, PROJECT, projectApi, projectGet } from './project-fixture'

export type Fake = ReturnType<typeof projectApi>

export async function loadForm(reply: ProjectGet = projectGet(), draft: BriefDraft = DRAFT) {
  const fake = projectApi(reply, draft)
  await renderApp(<ProjectHome project={PROJECT} />, fake)
  await userEvent.click(await screen.findByRole('button', { name: 'Load a brief' }))
  const form = await screen.findByRole('region', { name: 'Brief' })
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
