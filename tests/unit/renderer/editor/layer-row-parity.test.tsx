// ED-1b (spec/phases/design-wave-screens-a.md, choice C-3): the properties panel's Layer section
// goes, so each thing it did is proved here on the layer row, where it now lives. The rest
// (eye, lock, Duplicate, Bring forward, Send backward, Delete, the locked and background rules,
// an empty name) is in layer-row-menu.test.tsx and layer-list.test.tsx.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HEADLINE, P } from './editor-fixture'
import { LAYERS, openList } from './layer-list-harness'

const nameField = () => screen.getByRole('textbox', { name: 'Layer name' })

describe('Layer row: what the Layer section did [ED-1b, C-3]', () => {
  it('a rename saves once when focus leaves the field, trimmed', async () => {
    const { sent } = await openList(LAYERS, 'L1')
    await userEvent.dblClick(screen.getByText(HEADLINE.name))
    await userEvent.clear(nameField())
    await userEvent.type(nameField(), '  Summer headline ')
    await userEvent.tab()
    expect(sent('layer.update')).toEqual([
      { projectId: P, layerId: 'L1', patch: { name: 'Summer headline' } },
    ])
  })

  it('a refused rename shows its message and the row keeps the stored name', async () => {
    const { fake, store } = await openList(LAYERS, 'L1')
    const message = 'A layer name has 1 to 100 characters.'
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message },
    }))
    await userEvent.dblClick(screen.getByText(HEADLINE.name))
    await userEvent.type(nameField(), ' two{Enter}')
    await waitFor(() => expect(store.getState().error).toBe(message))
    expect(screen.getByText(HEADLINE.name)).toBeInTheDocument()
  })
})
