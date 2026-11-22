// The export dialog's warnings step [P8-11] (spec/phases/phase-08.md "Export run", warnings
// gate): the export_has_warnings refusal shows the warnings as text and sends nothing more;
// "Export anyway" sends the same input with proceedDespiteWarnings and the trimmed reason;
// "Back" returns to the ticks as they were. The refusal does not go to the error banner.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../render'
import * as fx from './export-fixture'

async function warned() {
  const view = await fx.openExport([fx.WARNED])
  await fx.chooseFolder()
  await userEvent.click(screen.getByRole('checkbox', { name: fx.ROWS[0] }))
  await fx.click('Export')
  await screen.findByText('These ads have warnings')
  return view
}

const reasonField = () =>
  screen.getByRole('textbox', { name: 'Reason for exporting anyway (optional)' })

describe('the export warnings step [P8-11]', () => {
  it('lists each warning as text, sends nothing more and leaves the banner empty', async () => {
    const { fake, store } = await warned()
    const list = screen.getByRole('list', { name: 'These ads have warnings' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('[title]')?.getAttribute('title') + ': ' + li.textContent),
    ).toEqual([
      'Picnic table · 9x16 · de: 9x16 · deThe headline runs past its box.Warning',
      'Beach walk · 9x16 · en: 9x16 · en<b>Low</b> contrast on the button.Warning',
    ])
    expect(list.querySelector('b')).toBeNull()
    expect(fx.exportsSent(fake)).toEqual([fx.input({ variantIds: ['V2', 'V3'] })])
    expect(store.getState().error).toBeNull()
    expect(reasonField()).toHaveAttribute('maxLength', '500')
    expect(await axeViolations()).toEqual([])
  })

  it('Export anyway sends the same input with proceedDespiteWarnings and the trimmed reason', async () => {
    const { fake } = await warned()
    await userEvent.type(reasonField(), '  Client signed off the long headline.  ')
    await fx.click('Export anyway')
    const again = fx.input({
      variantIds: ['V2', 'V3'],
      proceedDespiteWarnings: true,
      reason: 'Client signed off the long headline.',
    })
    expect(fx.exportsSent(fake)).toEqual([fx.input({ variantIds: ['V2', 'V3'] }), again])
    const bar = await screen.findByRole('progressbar', { name: 'Exporting' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('Export anyway with no reason sends no reason', async () => {
    const { fake } = await warned()
    await userEvent.type(reasonField(), '   ')
    await fx.click('Export anyway')
    const sent = fx.exportsSent(fake)
    expect(sent[1]).toEqual(fx.input({ variantIds: ['V2', 'V3'], proceedDespiteWarnings: true }))
  })

  it('Back returns to the dialog with the ticks kept and sends nothing', async () => {
    const { fake } = await warned()
    await fx.click('Back')
    expect(screen.queryByText('These ads have warnings')).toBeNull()
    expect(screen.getByRole('checkbox', { name: fx.ROWS[0] })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: fx.ROWS[1] })).toBeChecked()
    expect(fx.exportsSent(fake)).toHaveLength(1)
  })
})
