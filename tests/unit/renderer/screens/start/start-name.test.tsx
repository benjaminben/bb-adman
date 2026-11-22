// D10 as ruled for R2P-11: the start screen's name is the app mark and the word "AdManager",
// where the small rotated square and "Adman" were.
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StartScreen } from '@/renderer/screens/start/start-screen'
import { renderApp } from '../../render'
import { makeFakeApi } from '../../fake-api'

describe('the start screen name [R2P-11, D10]', () => {
  it('shows the app mark, hidden from screen readers, before the word AdManager', async () => {
    const view = await renderApp(<StartScreen />, makeFakeApi())
    act(() => view.store.getState().show({ kind: 'start' }))
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveAccessibleName('AdManager')
    const mark = within(heading).getByRole('presentation')
    expect(mark.tagName).toBe('IMG')
    expect(mark).toHaveAttribute('alt', '')
    // The bundler inlines the small SVG, or names its file.
    expect(mark.getAttribute('src')).toMatch(/^data:image\/svg\+xml|app-mark[\w-]*\.svg$/)
    expect(heading.firstElementChild).toBe(mark)
  })
})
