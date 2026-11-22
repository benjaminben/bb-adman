// spec/screens-ai.md, "The picture section of the properties panel": "Make pictures with AI"
// holds the generate fields, then the earlier options (P4-18).
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { LOGO, P } from './editor-fixture'

beforeEach(() => generateDrafts.setState({ drafts: {} }))

describe('PictureAi with the earlier options [spec/screens-ai.md]', () => {
  it('shows the earlier options after the generate fields', async () => {
    await renderApp(
      <main>
        <GeneratePanel projectId={P} campaignId="C1" layer={LOGO} />
      </main>,
      campaignApi(),
    )
    const section = screen.getByRole('group', { name: 'Generate' })
    const heading = await within(section).findByRole('region', { name: 'Earlier options' })
    const prompt = await within(section).findByRole('textbox', { name: 'Prompt' })
    expect(prompt.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await within(section).findByText('No earlier options for this layer.')).toBeVisible()
  })
})
