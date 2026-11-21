import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { renderApp } from '../../render'
import { PROJECT, projectApi } from './project-fixture'
import { addPhotos, photoStubs } from './brief-form-fixture'

type Fake = ReturnType<typeof projectApi>

async function open(button: 'Load a brief' | 'Type a brief', fake: Fake = projectApi()) {
  await renderApp(<ProjectHome project={PROJECT} />, photoStubs(fake))
  await userEvent.click(await screen.findByRole('button', { name: button }))
  return screen.findByRole('region', { name: 'Brief' })
}

function problemLines(form: HTMLElement) {
  const list = within(form).queryByRole('list', { name: 'Before the campaign can be made' })
  if (list === null) return []
  return within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent)
}

describe('a blank "Subject ID" is made from the name [ruling for S2-14]', () => {
  it('shows the made ID as the placeholder and sends it', async () => {
    const fake = projectApi()
    const form = await open('Load a brief', fake)
    await addPhotos(form)
    const first = within(form).getByRole('group', { name: 'Subject 1' })
    const name = within(first).getByLabelText('Name')
    const id = within(first).getByLabelText('Subject ID')
    await userEvent.clear(id)
    await userEvent.clear(name)
    expect(id).not.toHaveAttribute('placeholder')
    expect(problemLines(form)).toEqual(['Subject 1: enter a name.'])
    await userEvent.type(name, 'Lime can 330ml')
    expect(id).toHaveValue('')
    expect(id).toHaveAttribute('placeholder', 'Lime-can-330ml')
    expect(problemLines(form)).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    await waitFor(() => expect(fake.commands.map((c) => c.name)).toContain('campaign.create'))
    expect(fake.commands.find((c) => c.name === 'subject.create')?.input).toMatchObject({
      id: 'Lime-can-330ml',
    })
  })
})

describe('the problems box takes no space when empty [ruling for S2-14]', () => {
  it('keeps the empty live region in the same box as the buttons', async () => {
    const form = await open('Load a brief')
    await addPhotos(form)
    const live = form.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.childElementCount).toBe(0)
    const create = screen.getByRole('button', { name: 'Create campaign' })
    expect(live?.parentElement?.contains(create)).toBe(true)
    expect(live?.parentElement).not.toBe(form.querySelector('fieldset'))
  })
})
