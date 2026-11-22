// P8-10 [A-201]: the Settings "Export" section. Each control has a label and sends one
// settings.update patch; the exporter's name is checked by the settings schema first.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportSection } from '@/renderer/screens/settings/export-section'
import { reportsSettings } from '@/shared/schemas/settings'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp, axeViolations } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'

const HINT = 'Written into each report as the person who exported. It is not checked.'

function withExport(
  exportSettings: Partial<AppState['settings']['export']>,
  exporterName = '',
): AppState {
  const base = baseState()
  return {
    ...base,
    settings: {
      ...base.settings,
      export: { ...base.settings.export, ...exportSettings },
      reports: { exporterName },
    },
  }
}

async function section(state: AppState = withExport({})) {
  const fake = makeFakeApi(state)
  await renderApp(<ExportSection />, fake)
  const box = await screen.findByRole('region', { name: 'Export' })
  const updates = () => fake.commands.filter((c) => c.name === 'settings.update')
  return { box, updates }
}

describe('settings: the Export section [P8-10, A-201]', () => {
  it.each([
    ['Picture format', 'JPG', { export: { imageFormat: 'jpg' } }],
    ['Frame rate', '60 fps', { export: { fps: 60 } }],
  ])('sends the patch when %s changes', async (label, value, patch) => {
    const { box, updates } = await section()
    const group = within(box).getByRole('group', { name: label })
    await userEvent.click(within(group).getByRole('button', { name: value }))
    expect(updates()).toEqual([{ name: 'settings.update', input: patch }])
  })

  it('offers PNG and JPG, and 30 and 60 frames per second', async () => {
    const { box } = await section()
    const names = (label: string) =>
      within(within(box).getByRole('group', { name: label }))
        .getAllByRole('button')
        .map((o) => o.textContent)
    expect(names('Picture format')).toEqual(['PNG', 'JPG'])
    expect(names('Frame rate')).toEqual(['30 fps', '60 fps'])
  })

  it('hides JPG quality for PNG', async () => {
    const { box } = await section(withExport({ imageFormat: 'png' }))
    expect(within(box).queryByLabelText('JPG quality')).toBeNull()
  })

  it('shows the saved JPG quality for JPG', async () => {
    const { box } = await section(withExport({ imageFormat: 'jpg', jpgQuality: 90 }))
    expect(within(box).getByLabelText('JPG quality')).toHaveValue(90)
  })

  it('saves JPG quality when the field is left, and refuses a value outside 1 to 100', async () => {
    const { box, updates } = await section(withExport({ imageFormat: 'jpg', jpgQuality: 90 }))
    const field = within(box).getByLabelText('JPG quality')
    await userEvent.clear(field)
    await userEvent.type(field, '75')
    await userEvent.tab()
    expect(updates()).toEqual([{ name: 'settings.update', input: { export: { jpgQuality: 75 } } }])
    await userEvent.clear(field)
    await userEvent.type(field, '101')
    await userEvent.tab()
    expect(updates()).toHaveLength(1)
  })

  it('saves the trimmed name when the field is left, and shows the hint', async () => {
    const { box, updates } = await section()
    const field = within(box).getByLabelText('Report name')
    await userEvent.click(within(box).getByRole('button', { name: 'About report name' }))
    expect(screen.getByText(HINT)).toBeInTheDocument()
    await userEvent.type(field, '  Rowan Vale ')
    await userEvent.tab()
    expect(updates()).toEqual([
      { name: 'settings.update', input: { reports: { exporterName: 'Rowan Vale' } } },
    ])
  })

  it('saves the name on Enter, and an emptied name as an empty string', async () => {
    const { box, updates } = await section(withExport({}, 'Rowan Vale'))
    const field = within(box).getByLabelText('Report name')
    expect(field).toHaveValue('Rowan Vale')
    await userEvent.clear(field)
    await userEvent.type(field, '{Enter}')
    expect(updates()).toEqual([
      { name: 'settings.update', input: { reports: { exporterName: '' } } },
    ])
  })

  it("shows the schema's first issue for a 101-character name and sends nothing", async () => {
    const long = 'n'.repeat(101)
    const issue = reportsSettings.shape.exporterName.safeParse(long).error?.issues[0]?.message
    expect(issue).toBeTruthy()
    const { box, updates } = await section()
    const field = within(box).getByLabelText('Report name')
    await userEvent.click(field)
    await userEvent.paste(long)
    await userEvent.tab()
    expect(within(box).getByText(issue as string)).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(updates()).toEqual([])
  })

  it('draws the name as a plain text field, not a key field', async () => {
    const { box } = await section()
    const field = within(box).getByLabelText('Report name')
    expect(field).toHaveAttribute('type', 'text')
    expect(field.className).toBe('')
    expect(field.closest('fieldset')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { box } = await section(withExport({ imageFormat: 'jpg' }))
    expect(await axeViolations(box)).toEqual([])
  })
})
