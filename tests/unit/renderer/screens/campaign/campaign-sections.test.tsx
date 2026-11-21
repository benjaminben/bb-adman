// P6-1 (spec/phases/phase-06.md, design addition 8): under the run list, the rule set, checks
// and translations sections in that order; translations only when the campaign has a language
// other than its primary one. The panels are their slices' own; here they are stand-ins.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CampaignSections } from '@/renderer/screens/campaign/campaign-sections'
import { MASTER, P, campaignGet } from './campaign-fixture'

type PanelProps = { projectId: string; campaignId: string }
const { panel } = vi.hoisted(() => ({
  panel: (name: string) => (props: PanelProps) => (
    <p>
      {name} {props.projectId.length > 0 ? 'P' : '?'} {props.campaignId}
    </p>
  ),
}))

vi.mock('@/renderer/screens/campaign/rule-set-panel', () => ({ RuleSetPanel: panel('rules') }))
vi.mock('@/renderer/screens/campaign/check-panel', () => ({ CheckPanel: panel('checks') }))
vi.mock('@/renderer/screens/campaign/translation-panel', () => ({
  TranslationPanel: panel('translations'),
}))

function shown(languages: string[]) {
  const data = campaignGet([MASTER])
  data.campaign.languages = languages
  render(<CampaignSections projectId={P} campaignId="C1" data={data} />)
  return screen.queryAllByText(/^(rules|checks|translations) P C1$/).map((p) => p.textContent)
}

describe('CampaignSections [P6-1]', () => {
  it('shows the three sections in order when the campaign has another language', () => {
    expect(shown(['en', 'de'])).toEqual(['rules P C1', 'checks P C1', 'translations P C1'])
  })

  it('leaves translations out when every language is the primary one', () => {
    expect(shown(['en'])).toEqual(['rules P C1', 'checks P C1'])
  })
})
