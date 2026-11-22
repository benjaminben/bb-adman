// SET-3: the Files page (spec/phases/design-wave-screens-a.md "SET-3"). The projects folder is
// one row, its path cut in the middle with the whole path in the tooltip and the accessible
// name; Export is inline fields and two Segmented groups. Same commands as before.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { middleCut } from '@/renderer/ui/middle-cut'
import { reportsSettings } from '@/shared/schemas/settings'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const LONG = '/Users/rowan/Documents/Client work/Northwind Bakery/Spring launch/Adman Projects'

function state(imageFormat: 'png' | 'jpg' = 'png'): AppState {
  const base = baseState()
  return {
    ...base,
    settings: {
      ...base.settings,
      defaultProjectDir: LONG,
      export: { ...base.settings.export, imageFormat },
    },
  }
}

async function filesPage(imageFormat: 'png' | 'jpg' = 'png') {
  const fake = makeFakeApi(state(imageFormat))
  await renderApp(<SettingsScreen page="files" />, fake)
  const folder = screen.getByRole('region', { name: 'Projects folder' })
  const exportBox = screen.getByRole('region', { name: 'Export' })
  const updates = () => fake.commands.filter((c) => c.name === 'settings.update')
  return { fake, folder, exportBox, updates }
}

describe('settings: the Files page [SET-3]', () => {
  it('shows the folder cut in the middle, whole in the tooltip and the name', async () => {
    const { folder } = await filesPage()
    const row = within(folder).getByRole('button', { name: `Projects folder ${LONG}` })
    expect(row.parentElement).toHaveAttribute('title', LONG)
    expect(within(folder).getByText(middleCut(LONG))).toBeVisible()
    expect(within(folder).queryByText(LONG)).toBeNull()
    expect(middleCut(LONG)).not.toBe(LONG)
  })

  it('changes the folder through the system picker with the same commands', async () => {
    const { fake, folder } = await filesPage()
    fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: '/Volumes/Work' } }))
    const change = within(folder).getByRole('button', { name: 'Change default location' })
    expect(change).toHaveTextContent(/^Change$/)
    await userEvent.click(change)
    expect(fake.queries.map((q) => q.name)).toContain('dialog.pickFolder')
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { defaultProjectDir: '/Volumes/Work' },
    })
  })

  it('draws Picture as a group of PNG and JPG, and JPG sends the format', async () => {
    const { exportBox, updates } = await filesPage()
    const group = within(exportBox).getByRole('group', { name: 'Picture format' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['PNG', 'true'],
      ['JPG', 'false'],
    ])
    expect(within(exportBox).queryByLabelText('JPG quality')).toBeNull()
    await userEvent.click(within(group).getByRole('button', { name: 'JPG' }))
    expect(updates()).toEqual([
      { name: 'settings.update', input: { export: { imageFormat: 'jpg' } } },
    ])
  })

  it('shows JPG quality for JPG, with "%" inside the box and outside its name', async () => {
    const { exportBox } = await filesPage('jpg')
    const quality = within(exportBox).getByLabelText('JPG quality')
    expect(quality).toHaveAccessibleName('JPG quality')
    expect(quality.parentElement).toHaveTextContent('%')
    expect(within(exportBox).getByText('Quality')).toBeVisible()
  })

  it('draws Frame rate as a group, and 60 fps sends fps 60', async () => {
    const { exportBox, updates } = await filesPage()
    const group = within(exportBox).getByRole('group', { name: 'Frame rate' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['30 fps', '60 fps'])
    await userEvent.click(within(group).getByRole('button', { name: '60 fps' }))
    expect(updates()).toEqual([{ name: 'settings.update', input: { export: { fps: 60 } } }])
  })

  it('saves the report name on leaving, with a placeholder and an InfoTip', async () => {
    const { exportBox, updates } = await filesPage()
    const field = within(exportBox).getByLabelText('Report name')
    expect(field).toHaveAttribute('placeholder', 'Name not set')
    await userEvent.click(within(exportBox).getByRole('button', { name: 'About report name' }))
    expect(
      screen.getByText('Written into each report as the person who exported. It is not checked.'),
    ).toBeInTheDocument()
    await userEvent.type(field, 'Rowan Vale')
    await userEvent.tab()
    expect(updates()).toEqual([
      { name: 'settings.update', input: { reports: { exporterName: 'Rowan Vale' } } },
    ])
  })

  it('shows a refused name as one danger line and keeps the text', async () => {
    const long = 'n'.repeat(101)
    const issue = reportsSettings.shape.exporterName.safeParse(long).error?.issues[0]?.message
    const { exportBox, updates } = await filesPage()
    const field = within(exportBox).getByLabelText('Report name')
    await userEvent.click(field)
    await userEvent.paste(long)
    await userEvent.tab()
    expect(within(exportBox).getByText(issue as string)).toBeVisible()
    expect(field).toHaveValue(long)
    expect(field).toHaveAccessibleDescription(issue as string)
    expect(updates()).toEqual([])
  })

  it('is gone of the old words', async () => {
    await filesPage('jpg')
    for (const words of ['New projects', 'Default location', 'Frames per second']) {
      expect(screen.queryByText(words)).toBeNull()
    }
    expect(screen.queryByText('Name shown in reports')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await filesPage('jpg')
    expect(await axeViolations(screen.getByRole('region', { name: 'Settings' }))).toEqual([])
  })
})
