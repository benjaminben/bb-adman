// spec/approvals.md "The campaign page", the approval bar: "Approval link…"; with a live link
// the signed-off count, "Checked {time}" or the last refresh's failure, and "Refresh"; with an
// ended link "Link turned off"; after a gone reply the gone sentence.
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import iconStyles from '@/renderer/ui/icon/icon.module.css'
import markStyles from '@/renderer/ui/status-mark/status-mark.module.css'
import { ApprovalBar, ApprovalFailure } from '@/renderer/screens/campaign/approval-bar'
import { createApprovalsStore, type ApprovalsStoreState } from '@/renderer/stores/approvals-store'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { timeText } from '@/renderer/ui/signoff-list'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import {
  C,
  P,
  TITLES,
  VARIANTS,
  endedLink,
  forCampaign,
  liveLink,
} from '../../stores/approvals-fixture'

const OFFLINE = 'The approvals service could not be reached. Check the address and your connection.'
const GONE = APPROVALS_REASON_MESSAGES.approval_link_gone
const CHECKED = `Checked ${timeText(liveLink().checkedAt ?? '')}`

async function showBar(state: Partial<ApprovalsStoreState>) {
  const fake = makeFakeApi()
  const store = createApprovalsStore(fake.api, P, C)
  store.setState(state)
  const view = await renderApp(
    <main>
      <ApprovalBar projectId={P} campaignId={C} store={store} titles={TITLES} />
      <ApprovalFailure store={store} />
    </main>,
    fake,
  )
  return {
    ...view,
    fake,
    bar: screen.getByRole('group', { name: 'Approval link' }),
    page: screen.getByRole('main'),
  }
}

describe('approval bar [spec/approvals.md "The campaign page"]', () => {
  it.each([
    ['a live link', { data: forCampaign() }, ['Signed off: 1 of 2 variants', CHECKED], [GONE]],
    [
      'a failed refresh',
      { data: forCampaign(), failure: OFFLINE },
      ['Signed off: 1 of 2 variants', OFFLINE],
      [CHECKED],
    ],
    ['an ended link', { data: forCampaign({ link: endedLink() }) }, ['Link turned off'], [GONE]],
    [
      'a link found gone',
      { data: forCampaign({ link: endedLink() }), notice: GONE },
      [GONE],
      ['Link turned off', 'Signed off'],
    ],
    ['no link', { data: forCampaign({ link: null }) }, [], ['Signed off', 'Link turned off']],
  ])('with %s, draws its lines', async (_name, state, shown, hidden) => {
    const { page } = await showBar(state)
    expect(screen.getByRole('button', { name: /^Approval link…/ })).toBeEnabled()
    for (const line of shown) expect(page).toHaveTextContent(line)
    for (const line of hidden) expect(page).not.toHaveTextContent(line)
    const refresh = screen.queryByRole('button', { name: 'Refresh' })
    expect(refresh !== null).toBe(state.data.link?.state === 'live')
    expect(await axeViolations()).toEqual([])
  })

  it('sends approvals.refresh on "Refresh"', async () => {
    const { fake } = await showBar({ data: forCampaign() })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(fake.commands).toEqual([
      { name: 'approvals.refresh', input: { projectId: P, campaignId: C } },
    ])
  })

  it('draws "Refresh" disabled while a refresh runs', async () => {
    await showBar({ data: forCampaign(), refreshing: true })
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  })

  it('opens the approval link dialog', async () => {
    await showBar({ data: forCampaign() })
    await userEvent.click(screen.getByRole('button', { name: /^Approval link…/ }))
    expect(screen.getByRole('dialog', { name: 'Approval link' })).toBeInTheDocument()
  })

  it('keeps "Approval link…" disabled until the first read arrives', async () => {
    await showBar({ data: null })
    expect(screen.getByRole('button', { name: /^Approval link…/ })).toBeDisabled()
  })

  it.each([
    [[VARIANTS[0]!], 'Signed off: 1 of 1 variant'],
    [[VARIANTS[1]!], 'Signed off: 0 of 1 variant'],
    [[], 'Signed off: 0 of 0 variants'],
  ])('writes the count in the singular only for one variant [AP-12]', async (variants, line) => {
    const { bar } = await showBar({ data: forCampaign({ variants }) })
    expect(bar).toHaveTextContent(new RegExp(`${line}(?!s)`))
  })
})

// CAMP-3 (spec/phases/design-wave-screens-b.md, "CAMP-3"): one button "Approvals" with the count
// as a mark; the sentences move to its title, except a failure and an ended link, which stay
// words on the page. Counts and times only: no address, password or email anywhere.
describe('the approvals button [CAMP-3]', () => {
  const button = () => screen.getByRole('button', { name: /^Approval link…/ })
  const strings = (root: Element) =>
    [root, ...root.querySelectorAll('*')].flatMap((el) => [
      ...[...el.attributes].map((a) => a.value),
      el.textContent ?? '',
    ])

  it.each([
    ['no link', { data: forCampaign({ link: null }) }, 'Approval link…', null, ''],
    [
      'a live link',
      { data: forCampaign() },
      'Approval link… 1/2',
      `Signed off: 1 of 2 variants. ${CHECKED}`,
      '1/2',
    ],
    [
      'a failed refresh',
      { data: forCampaign(), failure: OFFLINE },
      'Approval link… 1/2',
      'Signed off: 1 of 2 variants',
      '1/2',
    ],
    [
      'an ended link',
      { data: forCampaign({ link: endedLink() }) },
      'Approval link… off',
      'Link turned off',
      'Off',
    ],
    [
      'a link found gone',
      { data: forCampaign({ link: endedLink() }), notice: GONE },
      'Approval link… off',
      GONE,
      'Off',
    ],
  ])('with %s, names and titles the button', async (_n, state, name, title, mark) => {
    const { bar } = await showBar(state)
    expect(button()).toHaveAccessibleName(name)
    expect(button().getAttribute('title')).toBe(title)
    expect(button()).toHaveTextContent(new RegExp(`^Approvals${mark}`))
    for (const text of strings(bar)) {
      expect(text).not.toContain('approvals.example.com')
      expect(text).not.toContain('@example.com')
    }
  })

  it('keeps a refresh failure and an ended link as visible words beside the button', async () => {
    const failed = await showBar({ data: forCampaign(), failure: OFFLINE })
    expect(button()).not.toContainElement(within(failed.page).getByText(OFFLINE))
    failed.unmount()
    const ended = await showBar({ data: forCampaign({ link: endedLink() }) })
    expect(button()).not.toContainElement(within(ended.bar).getByText('Link turned off'))
  })

  it('marks the count "ok" only when every variant in the gallery is signed', async () => {
    const all = await showBar({ data: forCampaign({ variants: [VARIANTS[0]!] }) })
    const signed = within(button()).getByText('1/1').parentElement
    expect(signed).toHaveClass(markStyles.ok as string)
    all.unmount()
    await showBar({ data: forCampaign() })
    expect(within(button()).getByText('1/2').parentElement).toHaveClass(markStyles.none as string)
  })

  it('draws "Refresh" as an icon button that turns while refreshing', async () => {
    const idle = await showBar({ data: forCampaign() })
    const refresh = screen.getByRole('button', { name: 'Refresh' })
    expect(refresh).toHaveAttribute('title', 'Refresh')
    expect(refresh).toHaveTextContent('')
    expect(refresh.querySelector(`.${iconStyles.spin}`)).toBeNull()
    idle.unmount()
    await showBar({ data: forCampaign(), refreshing: true })
    const turning = screen.getByRole('button', { name: 'Refresh' })
    expect(turning.querySelector(`.${iconStyles.spin}`)).not.toBeNull()
    expect(turning).toBeDisabled()
  })
})
