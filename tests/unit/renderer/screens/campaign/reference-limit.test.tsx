// F-8 [A-56]: once MAX_REFERENCES_PER_RUN pictures are ticked, the others cannot be ticked,
// and one line says why.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { axeViolations } from '../../render'
import { P, renderWith } from './campaign-fixture'
import { ref, referenceApi } from './reference-fixture'

const view = <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
const LINE = 'A run takes at most 8 reference pictures.'

describe('ReferencePicker at the limit [F-8, A-56]', () => {
  it('stops a ninth tick at 8 pictures and says why; unticking one frees it', async () => {
    const names = Array.from({ length: 9 }, (_, i) => `R${i + 1}`)
    const { fake } = referenceApi(names.map((id) => ref(id)))
    await renderWith(view, fake)
    const p = within(await screen.findByRole('region', { name: 'Reference pictures' }))
    await p.findByRole('checkbox', { name: 'R9.png' })
    expect(p.queryByText(LINE)).toBeNull()

    for (const id of names.slice(0, 8))
      await userEvent.click(p.getByRole('checkbox', { name: `${id}.png` }))

    const ninth = p.getByRole('checkbox', { name: 'R9.png' })
    expect(ninth).toBeDisabled()
    expect(ninth).not.toBeChecked()
    expect(p.getByText(LINE)).toBeInTheDocument()
    expect(p.getByRole('checkbox', { name: 'R8.png' })).toBeEnabled()
    expect(await axeViolations()).toEqual([])

    await userEvent.click(p.getByRole('checkbox', { name: 'R8.png' }))
    expect(ninth).toBeEnabled()
    expect(p.queryByText(LINE)).toBeNull()
  })
})
