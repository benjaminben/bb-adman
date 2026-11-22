// R2-Q fault C: the "+" in the top bar, named "New campaign" with a matching tooltip, shows the
// Project tab from any tab and opens the project home's empty brief form (as "Start from an empty form" does) with
// the keyboard focus in its first field. A form already open keeps what was typed.
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignTabs, useCampaignTab } from '@/renderer/app/campaign-tabs'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { axeViolations, renderApp } from '../render'
import { PROJECT, campaign, projectApi, projectGet } from '../screens/project-home/project-fixture'
import { photoStubs } from '../screens/project-home/brief-form-fixture'

const SUMMER = campaign('C1', 'Summer Splash')

function Shell(props: { open: string[] }) {
  const nav = useNavStore()
  useEffect(() => {
    for (const id of props.open) nav.getState().openCampaign('P1', id)
  }, [nav, props.open])
  const tab = useCampaignTab('P1')
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange}>
      <CampaignTabs projectId="P1" />
      <Tabs.Content value={tab.value}>
        <ProjectHome project={PROJECT} />
      </Tabs.Content>
    </Tabs.Root>
  )
}

async function draw(open: string[]) {
  const fake = photoStubs(projectApi(projectGet([SUMMER])))
  await renderApp(
    <main>
      <NavScope>
        <Shell open={open} />
      </NavScope>
    </main>,
    fake,
  )
  if (open.length > 0) await screen.findByRole('tab', { name: 'Summer Splash' })
  else await screen.findByRole('button', { name: 'Paste a brief' })
  return fake
}

const plus = () => screen.getByRole('button', { name: 'New campaign' })
const form = () => screen.findByRole('region', { name: 'Brief' })

describe('"+" starts a new campaign [R2-Q C]', () => {
  it('is named "New campaign" and has the same tooltip', async () => {
    await draw([])
    expect(plus()).toHaveAttribute('title', 'New campaign')
  })

  it.each([
    ['the Project tab', []],
    ['a campaign tab', ['C1']],
  ])(
    'from %s, shows the Project tab and opens the brief form, focus in its first field',
    async (_, open) => {
      const fake = await draw(open)
      const before = fake.commands.length
      await userEvent.click(plus())
      expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true')
      const opened = await form()
      await waitFor(() => expect(within(opened).getByLabelText('Campaign name')).toHaveFocus())
      expect(fake.commands).toHaveLength(before)
    },
  )

  it('keeps an open form as typed and puts the focus back in its first field', async () => {
    await draw([])
    await userEvent.click(await screen.findByRole('button', { name: 'Paste a brief' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Start from an empty form' }))
    const opened = await form()
    const name = within(opened).getByLabelText('Campaign name')
    await userEvent.type(name, 'Autumn')
    await userEvent.click(plus())
    expect(screen.getAllByRole('region', { name: 'Brief' })).toHaveLength(1)
    expect(within(await form()).getByLabelText('Campaign name')).toHaveValue('Autumn')
    await waitFor(() => expect(within(opened).getByLabelText('Campaign name')).toHaveFocus())
  })

  it('has no accessibility violations with the form open', async () => {
    await draw([])
    await userEvent.click(plus())
    await form()
    expect(await axeViolations()).toEqual([])
  })
})
