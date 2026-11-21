// spec/approvals-service.md "The pages": the password page. No campaign name, since the visitor
// has not proven anything yet. The failure sentence is the one reply to all three failures.
import { documentOf, html } from './html'

export const FAILURE =
  'That password did not work. If you have tried many times, wait 15 minutes and try again.'

export function passwordPage(slug: string, failed: boolean) {
  const failure = failed ? html`<p class="notice failure" role="alert">${FAILURE}</p>` : html``
  return documentOf(
    'Review campaign',
    html`<h1>Review campaign</h1>
      <p>Enter the password you were given.</p>
      ${failure}
      <form method="post" action="/l/${slug}/enter">
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <button type="submit">Open</button>
      </form>`,
  )
}

const REFUSED = 'This form could not be sent. Open the link again and try once more.'

// The 403 page of "Forms that write".
export function refusedPage() {
  return documentOf(
    'Review campaign',
    html`<h1>Review campaign</h1>
      <p>${REFUSED}</p>`,
  )
}
