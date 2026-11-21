import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '@/renderer/app/app-context'
import { MissingFiles } from '@/renderer/screens/project-home/missing-files'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { asset, serveAssets } from '../../dialogs/relink-fixture'

describe('the missing-file line [spec/screens-campaign.md, relink dialog; FR-009]', () => {
  it('draws nothing when no file is missing', async () => {
    const { container } = await renderApp(<MissingFiles projectId="p1" missingCount={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says how many files cannot be found and offers to find them', async () => {
    await renderApp(<MissingFiles projectId="p1" missingCount={3} />)
    expect(screen.getByText('3 file(s) this project links to cannot be found.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find missing files…' })).toBeInTheDocument()
  })

  it('opens the relink dialog, which stays open when the count drops to 0', async () => {
    const fake = makeFakeApi()
    serveAssets(fake, [asset('a1', 'hero-shot.png')])
    const view = await renderApp(<MissingFiles projectId="p1" missingCount={1} />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Find missing files…' }))
    expect(screen.getByRole('dialog', { name: 'Find missing files' })).toBeInTheDocument()

    view.rerender(
      <AppProvider api={fake.api} store={view.store}>
        <MissingFiles projectId="p1" missingCount={0} />
      </AppProvider>,
    )
    expect(screen.getByRole('dialog', { name: 'Find missing files' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Find missing files…' })).toBeNull()
  })
})
