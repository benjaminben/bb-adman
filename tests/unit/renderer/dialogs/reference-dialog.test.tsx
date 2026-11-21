// spec/screens-ai.md, "Reference dialog" [A-68]: two lists, the project's reference pictures
// and the pictures made in it; one ordered list of ticks across both, at most
// MAX_REFERENCES_PER_RUN; Done keeps the ticks, Cancel drops this visit's changes.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceDialog } from '@/renderer/dialogs/reference-dialog'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P } from '../screens/campaign/campaign-fixture'
import { ref } from '../screens/campaign/reference-fixture'

const made = (id: string) => ref(id, { library: 'asset', origin: 'generated' })

function api(refs: AssetList, assets: AssetList) {
  const fake = makeFakeApi()
  fake.onQuery('asset.list', (input) => ({
    ok: true,
    data: (input as { library?: string }).library === 'asset' ? assets : refs,
  }))
  return fake
}

// Opens the dialog, closes it on Done or Cancel, and opens it again from "Open".
function Harness(props: {
  chosen: string[]
  onDone: (ids: string[]) => void
  onCancel: () => void
}) {
  const [shown, setShown] = useState(true)
  return (
    <main>
      <button type="button" onClick={() => setShown(true)}>
        Open
      </button>
      <ReferenceDialog
        open={shown}
        projectId={P}
        layerName="Logo"
        subjectId={undefined}
        chosen={props.chosen}
        onDone={(ids) => {
          setShown(false)
          props.onDone(ids)
        }}
        onCancel={() => {
          setShown(false)
          props.onCancel()
        }}
      />
    </main>
  )
}

async function open(opts: { chosen?: string[]; refs?: AssetList; assets?: AssetList } = {}) {
  const fake = api(
    opts.refs ?? [ref('R1'), ref('R2')],
    opts.assets ?? [made('G1'), ref('I1', { library: 'asset' })],
  )
  const onDone = vi.fn()
  const onCancel = vi.fn()
  const chosen = opts.chosen ?? []
  await renderApp(<Harness chosen={chosen} onDone={onDone} onCancel={onCancel} />, fake)
  const dialog = await screen.findByRole('dialog', { name: 'Reference pictures for Logo' })
  await within(dialog).findByRole('checkbox', { name: 'R1.png' })
  await within(dialog).findByRole('checkbox', { name: 'G1.png' })
  return { fake, dialog, onDone, onCancel }
}

const list = (name: string) => within(screen.getByRole('region', { name }))
const box = (name: string) => screen.getByRole('checkbox', { name })

describe('ReferenceDialog [spec/screens-ai.md "Reference dialog"; A-68]', () => {
  it('shows two lists: the reference pictures, and the pictures made in this project', async () => {
    const { fake } = await open()
    const asked = fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)
    expect(asked).toEqual([
      { projectId: P, kind: 'image' },
      { projectId: P, library: 'asset', kind: 'image' },
    ])
    const names = list('Reference pictures')
      .getAllByRole('checkbox')
      .map((b) => b.closest('label')?.textContent)
    expect(names).toEqual(['R1.png', 'R2.png'])
    expect(list('Made in this project').getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.queryByRole('checkbox', { name: 'I1.png' })).toBeNull()
    expect(list('Reference pictures').getByRole('button', { name: 'Add pictures' })).toBeVisible()
    expect(list('Made in this project').queryByRole('button', { name: 'Add pictures' })).toBeNull()
  })

  it('ticks across both lists are one ordered list, and Done gives them in that order', async () => {
    const { onDone, onCancel } = await open({ chosen: ['R1'] })
    expect(box('R1.png')).toBeChecked()
    await userEvent.click(box('G1.png'))
    await userEvent.click(box('R2.png'))
    expect(list('Made in this project').getByText('2')).toBeVisible()
    expect(list('Reference pictures').getByText('3')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledWith(['R1', 'G1', 'R2'])
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('refuses a tick past the limit and says so', async () => {
    const refs = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'].map((id) => ref(id))
    const chosen = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'G1']
    await open({ refs, assets: [made('G1'), made('G2')], chosen })
    expect(box('G2.png')).toBeDisabled()
    expect(screen.getByText('At most 8 pictures.')).toBeVisible()
    await userEvent.click(box('R3.png'))
    expect(box('G2.png')).toBeEnabled()
    expect(screen.queryByText('At most 8 pictures.')).toBeNull()
  })

  it("Cancel drops this visit's changes; opening again starts from the chosen pictures", async () => {
    const { onDone, onCancel } = await open({ chosen: ['R1'] })
    await userEvent.click(box('G1.png'))
    await userEvent.click(box('R1.png'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(box('R1.png')).toBeChecked())
    expect(box('G1.png')).not.toBeChecked()
  })

  it('has no axe violations', async () => {
    await open({ chosen: ['G1'] })
    expect(await axeViolations()).toEqual([])
  })
})
