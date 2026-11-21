// spec/editor.md "Top bar" (LK-6): "Layout…" sits after "Place text with AI…" and opens the
// layout dialog for the open variant; Apply's layer.updateMany names that variant.
import '../../shared/scene/fake-fonts'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

// Keyed as a master's layers are, so the layouts name them.
const LAYERS = [
  { ...BACKGROUND, key: 'background' },
  { ...HEADLINE, key: 'headline' },
  { ...LOGO, key: 'logo' },
]

async function open() {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: variantGet({ layers: LAYERS }) }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  await screen.findByRole('heading', { name: 'Master post' })
  return fake
}

describe('Top bar "Layout…" [spec/editor.md "Top bar", LK-6]', () => {
  it('comes right after "Place text with AI…"', async () => {
    await open()
    const bar = screen.getByRole('banner')
    const names = within(bar)
      .getAllByRole('button')
      .map((b) => b.textContent)
    const place = names.indexOf('Place text with AI…')
    expect(place).toBeGreaterThanOrEqual(0)
    expect(names[place + 1]).toBe('Layout…')
  })

  it('opens the layout dialog for the open variant, and Apply sends for it', async () => {
    const fake = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Layout…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Choose a layout' })
    expect(within(dialog).getAllByRole('radio')).toHaveLength(5)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const sent = fake.commands.filter((c) => c.name === 'layer.updateMany').map((c) => c.input)
    expect(sent).toEqual([expect.objectContaining({ projectId: P, variantId: V })])
  })
})
