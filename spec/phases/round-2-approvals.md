# Round 2: the approvals gallery and the app's approval views

The stakeholder's hand-testing feedback, items 18 to 22 (2026-11-21), with the orchestrator's rulings R-10 and R-11 and the stakeholder's note on them. Read with `spec/approvals-gallery.md`, `spec/approvals-service-visitor.md`, `spec/approvals-service.md`, `spec/approvals-service-tests.md`, `spec/approvals.md` ("Versions and marks", "Screens") and `spec/app-style.md`. Rules for every slice: `spec/phases/README.md` "Rules for every phase" and `spec/phases/DEV-RULES.md`. A later pass folds what is built into the topic files; until then this file rules where it differs from them.

## Goal

A reviewer opens the link and sees a gallery in the app's own look: a sidebar with the campaign title, short instructions, "Signing off as:" with one email field, "Sign off all" and "Log out"; a masonry of variant cards where a card that still needs this reviewer's sign-off plainly stands out and a signed-off card shows a small green tick; and a large view (lightbox) for each variant with its sign-off button. A sign-off given for an older version is not shown anywhere, in the gallery or the app: a changed variant reads as not signed off.

## Status

Built and merged on `main`: R2A-1 to R2A-9. Video variants now play in the gallery too (`round-2-approvals-video.md`), so A-374 no longer holds. The rules now live in the approvals topic files; this file keeps the design for reference.

## The stakeholder's items and rulings

- **Item 18.** The gallery takes the app's colours, type, radii and spacing.
- **Item 19, R-10.** "For an earlier version" goes, in the gallery and in the app. When a variant changes after a sign-off, that sign-off is no longer shown; the stored row may stay. The stakeholder's note: "this will be clear if we make signed-off vs not obvious by accent/highlight".
- **Item 20, R-11.** A sidebar: "Signing off as: {email field}", used for every sign-off; "Sign off all"; "Log out" in place of "Leave"; the campaign title and instructions. The email is kept for the browser session only. "Sign off all" signs every variant on the page that this email has not signed at its current version. Nothing about the Origin check, the password hash, the no-store rule for pictures or the secrets rules is loosened.
- **Item 21.** A masonry of cards. Not signed off by this reviewer: a full-width "Sign off" button along the card's bottom. Signed off: only a small green tick in the bottom right corner.
- **Item 22.** A lightbox to view a variant large, with the sign-off button in it.

## Design additions

### What stays exactly as built

- The form checks of "Forms that write" (Origin equal to the request's own origin, `Sec-Fetch-Site`, the form content type, the 8 KiB cap, the session), in that order, for every new and changed route. No forwarded header is read, no second origin is allowed.
- The session cookie, its row, the 12-hour end, the try limit, the password hash and its iterations, the one reply for a wrong password, an unknown slug and too many tries.
- The page policy, byte for byte (`pagePolicy` in `src/visitor/headers.ts`). No `media-src`, no outside host of any kind, no web font.
- The picture route and its header set, `Cache-Control: no-store` included. The lightbox shows the same picture route address as the card.
- Logs: the route or page name and the error's name only. Never an email, cookie, slug or body.
- Every page and every form still works with JavaScript switched off (the script added in R2A-8 only adds arrow keys, a fallback for older browsers and the masonry fallback).

### Where the look comes from (item 18)

- **Copied token file.** `approvals-service/src/ui/app-tokens.css` is a byte-equal copy of the app's `src/renderer/ui/tokens.css`. A root test, `tests/unit/config/approvals-tokens.test.ts` (in the app's `npm test`, beside the contract copy test), fails when the two differ. A token change is made in the app and copied in the same commit. The service keeps building and deploying from `approvals-service/` alone, since the copy lives inside it.
- **The service's own test** (`test/tokens.test.ts`): `app-tokens.css` and `gallery-tokens.css` hold no `url(`, `@import`, `@font-face` or `http`, so no font, picture or style is ever fetched from anywhere. The page policy test stays as it is.
- **Gallery tokens.** `approvals-service/src/ui/tokens.css` is replaced by `src/ui/gallery-tokens.css`, which holds only what the app has no token for, each built from app tokens where it can be:

```css
:root {
  --gallery-sidebar: var(--width-menu);         /* 300px */
  --gallery-card-min: 260px;
  --gallery-tap: 44px;                          /* buttons and fields a finger can hit */
  --gallery-field-text: 16px;                   /* a phone does not zoom into a field of 16px or more */
  --gallery-tick: var(--chip-height);           /* 24px */
  --gallery-masonry-row: var(--space-1);        /* the row unit of the script's fallback */
  --gallery-placeholder: var(--color-surface);
}
```

- `app/layout.tsx` imports `app-tokens.css`, then `gallery-tokens.css`, then a small `src/ui/base.css` (box sizing; the body on `--color-page`, `--color-text`, `--font-body`, `--font-size-body`, `--leading-body`; `h1` to `h3` in `--font-title` at `--weight-title` and `--tracking-title`; the focus ring `--focus-ring-width` `--color-focus` with `--focus-ring-offset`; the visually hidden class `.hidden-text`). These are the only global stylesheets.
- **Old names go.** The gallery's own names (`--color-muted`, `--color-error-bg`, `--color-error-text`, `--color-placeholder`, `--text-small`, `--text-base`, `--text-title`, `--line-height`, `--card-min`, `--page-max`, the rem spaces) are replaced in every component by the app's names (`--color-text-muted`, `--color-danger-bg`, `--color-danger-text`, `--font-size-small`, and so on). The rule "no raw colour, size or font in a component" stays. The one raw value allowed in a component's CSS is the width in a media query (custom properties cannot be used there); it is always `48rem`.
- **The pieces, as `spec/app-style.md` "Shared pieces" draws them:** buttons (`--control-height`, raised to `--gallery-tap` on the gallery, `--radius`, edge `--color-control-border`; primary in `--color-accent` with `--color-accent-text`, hover `--color-accent-hover`; quiet with no edge), fields (label above in `--font-size-small` `--weight-medium` `--color-text-secondary`; input at `--gallery-tap`, text `--gallery-field-text`), notices (padding `var(--space-2) var(--space-3)`, `--radius`, info `--color-info-bg`/`--color-info-text`, error `--color-danger-bg`/`--color-danger-text`, ok `--color-ok-bg`/`--color-ok-text`), cards (`--color-bg`, edge `--color-line`, `--radius-md`, `--shadow-1`), dialogs (`--color-bg`, `--radius-lg`, `--shadow-3`, backdrop `--color-overlay`).
- Every text and ground pair used is one the app's contrast table already passes (`spec/app-style.md` "Contrast"). The green tick is `--color-ok-text` on `--color-ok-bg` (6.0 or more), and as a graphic it needs only 3:1.

### The page: layout

**Wide (48rem and up).** Two columns: the sidebar (`--gallery-sidebar` wide, ground `--color-surface-soft`, right edge `--color-line`, `position: sticky; top: 0; height: 100dvh; overflow-y: auto`, padding `--space-6`) and the main column (padding `--space-8`) with the notice, then the cards. The sidebar comes first in the page's order, so the email field and its default button come before every card (this matters for Enter, below).

**Narrow (under 48rem).** One column. The sidebar becomes a block at the top of the page, full width, not sticky, bottom edge `--color-line`, padding `--space-4`, in the same order. Then the cards, one lane. The lightbox fills the screen (`width: 100%; height: 100dvh; max-width: none; max-height: none; margin: 0; border-radius: 0`), the picture on top, the sign-off part below it, scrolling inside the dialog.

**Masonry (item 21).** `gallery-grid` lays the cards in lanes at least `--gallery-card-min` wide, gap `--space-4`, in gallery order across each row:

1. Where the browser has CSS grid lanes (`@supports (display: grid-lanes)`): `display: grid-lanes; grid-template-columns: repeat(auto-fill, minmax(var(--gallery-card-min), 1fr))`. No script.
2. Otherwise, with script on: a CSS grid with `grid-auto-rows: var(--gallery-masonry-row)`, and the script (R2A-8) sets each card's `grid-row-end: span {n}` from its measured height (through the element's style object, which the policy allows; never a `style` attribute in the markup), again on resize and when a picture loads.
3. Otherwise (no script, no grid lanes): today's grid with `align-items: start`. Cards keep their order; rows have gaps under shorter cards.

Multi-column CSS is not used: it orders cards down each column, so in a gallery of hundreds the second card would be far down the page. Each picture gets `width` and `height` attributes from its size line (`pictureSize(sizeLine)` in `src/ui/picture-size.ts`: `^(\d{1,5})\s*×\s*(\d{1,5})`, giving `{ width, height }` from 1 to 20000 each, or 1080 × 1080 when the line does not match), so the browser keeps the picture's shape before it loads and the lanes do not jump.

### The sidebar (item 20)

`reviewer-panel`, an `<aside aria-label="Review">`, holds in order:

1. The campaign name as the page's `h1` (`--font-size-title`).
2. The instructions, a `<p>` in `--color-text-secondary`: "Look at each variant and sign off on the ones you approve. Your email is saved with each sign-off. Anyone with this link can see who signed off, and can remove a sign-off."
3. The reviewer form: `<form id="reviewer" method="post" action="/l/{slug}/reviewer">`:
   - Label "Signing off as:" for `<input id="reviewer-email" type="email" name="email" autocomplete="email" required>`, with `defaultValue` the saved email or empty.
   - Hint under it (`--font-size-small`, `--color-text-muted`, `id="reviewer-hint"`, joined by `aria-describedby`): "Used for every sign-off on this page. Kept until you log out or close the browser."
   - The notice for `bad-email` (error, `role="alert"`, `id="reviewer-error"`, the field then has `aria-invalid="true"` and `aria-describedby="reviewer-hint reviewer-error"`) or `email-saved` (ok, `role="status"`), when `m` is one of them. These two show here and not at the top of the main column.
   - Hidden `<input type="hidden" name="seen" value="{stamp}">` (see "Sign off all").
   - The button "Use this email" (quiet, submit, no `name`). It is the form's first submit button, so Enter in the field saves the email and never signs anything.
4. "Sign off all" (`signoff-all`), described below.
5. "Log out": `<form method="post" action="/l/{slug}/leave">` with one quiet button "Log out". The route path stays `/leave`; only the words change.

### How the email is kept and checked (R-11)

- **Kept in a cookie for the browser session.** Name `__Host-adman-{slug}-as`; value the checked email; attributes exactly `Path=/; HttpOnly; Secure; SameSite=Lax`, with no `Max-Age` and no `Expires`, so the browser drops it when its session ends. No `Domain`. `HttpOnly`: no script reads it. The `__Host-` prefix: no other site or sub-domain can plant it. Each link has its own name. It is not the session cookie and grants nothing: every route still needs the session cookie.
- **Made in one file,** `src/visitor/reviewer.ts`: `reviewerCookie(slug, email)`, `clearedReviewerCookie(slug)` (the same attributes with `Max-Age=0`), and `reviewerOf(cookieText, slug)`, which finds the cookie of exactly that name and gives its value only when `Email.safeParse(value)` succeeds and the parsed value equals the value as sent (so it is already trimmed, lower case and ASCII); anything else is null.
- **Set** only by the visitor routes `POST /l/{slug}/reviewer` and `POST /l/{slug}/signoffs`, after every form check and the session check, and only when the posted `email` passes `Email`. **Cleared** by `POST /l/{slug}/leave` ("Log out"), which now clears both cookies. The page and `proxy.ts` never set either cookie (rule kept).
- **Read** only by `openGallery`, and only once the session is valid. The password page never reads it, so a real slug and an unknown one still give the same bytes whatever cookies are sent.
- **Shown** only as the field's value on the gallery page, drawn by React as an attribute value (escaped). Never in an address, a log line, a notice text or a reply header other than its own `Set-Cookie`.
- **Used:** every sign-off takes the posted `email` field (the field's current text), not the cookie. The cookie fills the field again after each redirect and tells the page which cards this reviewer has signed.
- **No email or a bad one:** the browser's own check stops an empty or malformed field on the card buttons and "Use this email" (the field is `required`, `type="email"`). The lightbox and the "Sign off all" confirmation post with `formnovalidate` (the field sits behind a modal dialog, where the browser cannot point at it), so the server's check answers: nothing is written, the cookie is left as it was, and the `303` goes to `/l/{slug}?m=bad-email` with no anchor, so a phone lands at the top where the field and its error are. Words, unchanged: "Enter a full email address, like name@company.com."

### Routes and data changes

No database change and no migration. No change to the keyed API or the shared contract.

| Route | Change |
|---|---|
| `POST /l/{slug}/reviewer` (new, `VISITOR_ROUTES` name `reviewer`) | Form `email`. Form checks 1 to 4. Good email: `303` to `/l/{slug}?m=email-saved` with the reviewer cookie. Bad: `303` to `?m=bad-email`, no cookie |
| `POST /l/{slug}/signoffs` | New fields (below). Sets the reviewer cookie whenever the email passes, whatever the result |
| `POST /l/{slug}/signoffs/{id}/remove` | Unchanged |
| `POST /l/{slug}/leave` | Also clears the reviewer cookie: two `Set-Cookie` headers |
| `POST /l/{slug}/enter`, the picture route, `robots.txt` | Unchanged |

`redirect(request, slug, options)` in `headers.ts` takes `cookies?: string[]` in place of `cookie?: string`, appending one `Set-Cookie` per entry; everything else about it is unchanged (the slug, notice and variant checks, the `303`).

**The sign-off form** (`POST /l/{slug}/signoffs`):

- `email`: required, passes `Email`, else `bad-email` (no anchor, nothing written).
- Exactly one of:
  - `one` = `{variantKey}.{version}` (from the card's or the lightbox's button, `name="one"`), matching `^([23456789abcdefghjkmnpqrstuvwxyz]{6})\.([0-9]{1,16})$` with the version passing `Version`. Then the existing single statement `addSignoffIfVariant` and the existing replies: `signed` or `changed`, with `#v-{variantKey}`. A malformed `one` is `changed`; it keeps the anchor only when the text before the first `.` is a valid variant key, and has no anchor otherwise. The two end-to-end scripts that seed a sign-off by posting the form (`e2e/shots.spec.ts`, `e2e/pictures/pictures.spec.ts`) post `one` too.
  - `all` = `1` (from the "Sign off all" confirmation). Then "Sign off all", below.
- Neither or both: `changed`, nothing written.
- `seen`: sent with every post from the reviewer form; read only for `all`.
- The old `variant` and `version` fields are no longer read. A page drawn before the change that posts them gets `changed` (nothing written).

**Sign off all: one request for all** (R-11). One request carries the whole act, so it is one write and the page needs nothing per variant in the body (the 8 KiB cap could not hold 500 pairs).

1. The signable set: the link's `gallery_variant` rows whose picture has not expired at now, in position order. These are exactly the pictures the page showed.
2. The stamp: `galleryStamp(set)` in `src/visitor/stamp.ts`, the SHA-256 (Web Crypto) of the lines `{variantKey}.{version}\n` of the set, as 64 lower-case hex letters. `openGallery` puts it in the view; the page sends it back as `seen`.
3. On `all`: `seen` must match `^[0-9a-f]{64}$` and equal the stamp of the set read now. Otherwise `303` to `?m=gallery-changed`, nothing written. So "Sign off all" signs exactly what the reviewer saw or nothing.
4. One `db.batch` (one transaction) of `addSignoffIfVariant` per variant of the set, each with a new 24-letter ID and the email. Each statement still writes only if that variant has that version for this link, so a gallery replaced between step 3 and step 4 adds no row for a changed variant. `INSERT OR IGNORE` makes a variant this email already signed add nothing. At most `GALLERY_MAX` (500) statements.
5. `303` to `?m=signed-all`, no anchor, with the reviewer cookie.

**The view** (`GalleryView`, built field by field as now) gains two fields and loses older sign-offs:

```ts
type GalleryView = {
  link: { slug: string; campaignName: string }
  variants: Array<{ variantKey: string; position: number; title: string; sizeLine: string; version: number; expired: boolean }>
  // Only sign-offs whose version equals their variant's current version (R-10); none for a
  // variant no longer in the gallery.
  signoffs: Array<{ id: string; variantKey: string; version: number; email: string; createdAt: number }>
  // The reviewer cookie's checked email, or null.
  reviewer: string | null
  // galleryStamp of the signable set.
  stamp: string
  notice: NoticeKey | null
}
```

The older rows stay in the database (the app reads them through the keyed API, which is unchanged); the view filters them out, so they never reach a page. `src/ui/group-signoffs.ts` is removed with its `earlier` group.

**Notices** (`visitor/notices.ts`), three new keys, all on the gallery:

| `m` | Where | Words |
|---|---|---|
| `signed-all` | Main column, info | "Your sign-offs were saved." |
| `gallery-changed` | Main column, info | "The gallery changed while you were looking. Nothing was signed. Look at it again, and sign off if you still approve." |
| `email-saved` | Sidebar, ok | "Your email is saved until you log out or close the browser." |

### The cards (items 19 and 21)

`variant-card`, `<article id="v-{variantKey}" aria-labelledby="t-{variantKey}">`, in this order: the picture (a button that opens the lightbox), the title (`h2 id="t-{variantKey}"`, `--font-size-heading`), the size line (muted, `--font-size-small`), the others line, then the bottom part. "Mine" means: `reviewer` is not null and a sign-off in the view has this variant, its current version and that email.

| State | Look | Bottom part | Text name |
|---|---|---|---|
| Needs this reviewer's sign-off (not mine, picture live; also every live card when no email is saved) | Edge `--indicator-width` in `--color-accent`, ground `--color-bg`, `--shadow-2` | Full-width primary button "Sign off", `type="submit" form="reviewer" name="one" value="{variantKey}.{version}"`, `aria-label="Sign off: {title}"`, at `--gallery-tap`, its corners following the card's bottom corners | The visible word "Sign off", and the hidden line "Waiting for your sign-off." (`.hidden-text`) |
| Signed off by this reviewer | Edge `--border-width` in `--color-line`, ground `--color-surface-soft`, `--shadow-1`, no button | The tick, bottom right: a button `type="button"` that opens the lightbox, `--gallery-tick` round, ground `--color-ok-bg`, check drawn in `--color-ok-text` (inline SVG, `aria-hidden`), `aria-label="Signed off by you. Open to view or remove."` | The tick button's name |
| Picture expired | Edge `--border-width` in `--color-line`, no shadow | None: the picture's place holds the expiry sentence ("This picture has expired. Ask the person who sent the link to update the gallery.") on `--gallery-placeholder` | The sentence |

- **Never colour alone:** each state has words (the button, the hidden line, the tick's name) as well as its edge and ground.
- **Other reviewers' sign-offs still show** (A-366): on the card as the muted line "Signed off by {n}" when n ≥ 1 (all current sign-offs, this reviewer's included; the same words as the app's tile mark), and in full in the lightbox, each with "Remove". Nothing about them is on the card beyond the count.
- **The picture button:** `<button type="button" commandfor="view-{variantKey}" command="show-modal" aria-label="View larger: {title}">` wrapping `<img src="/l/{slug}/p/{variantKey}/{version}" alt="" width height loading="lazy">` (the button carries the name, so the picture inside is decoration). Hover: `--shadow-2`. No hover-only control.
- "For an earlier version", its list and its heading are gone.

### The lightbox (item 22)

One `<dialog id="view-{variantKey}" class="lightbox" aria-labelledby="lt-{variantKey}" data-lightbox>` per card, inside the card's `<article>` and outside every `<form>`. It is opened by HTML's own command buttons (`commandfor` and `command="show-modal"`), which work with JavaScript off in current Chrome, Edge, Firefox and Safari; R2A-8 adds a small fallback for browsers without them when script is on.

- **What it holds:** a top row with the title (`h2 id="lt-{variantKey}"`), the size line, and "Close" (`type="button" commandfor="view-{variantKey}" command="close"`, first in the dialog so it takes focus on open); the picture, large (`max-width: 100%; max-height: calc(100dvh - 14rem)` wide, the whole width on a phone, `object-fit: contain`; the same address as the card, `loading="lazy"`, so it loads when first opened; the alt text is the title here); then the sign-off part:
  - Not mine, picture live: primary "Sign off" (`form="reviewer" name="one" value="{variantKey}.{version}" formnovalidate`, `aria-label="Sign off: {title}"`) and under it "Signing off as {email}." when `reviewer` is set, or "Uses the email under “Signing off as:”." when not.
  - Mine: the tick and "Signed off by you."
  - Expired: the expiry sentence; no button.
  - "Signed off by" (`h3`): each current sign-off, oldest first, as `{email} · {date}` with a quiet "Remove" button in its own `<form method="post" action="/l/{slug}/signoffs/{id}/remove">`, `aria-label="Remove sign-off by {email}"`. None: "No sign-offs yet." **This is where a sign-off is removed** (anyone with the link may remove any sign-off [D-095]).
  - A row with "Previous" and "Next" (`type="button"`, `data-step="-1"` and `"1"`), drawn with the `hidden` attribute; R2A-8's script shows them.
- **Keyboard:** Escape closes (the browser's own, for a modal dialog). Tab stays inside the dialog: a modal dialog makes the rest of the page inert (the browser's own; it may also reach the browser's own controls, which is normal). Closing puts focus back on the button that opened it (the browser's own; R2A-8 does it for a dialog reached by arrow keys). With script on: Right arrow or "Next" closes this dialog and opens the next card's in gallery order; Left arrow or "Previous" the one before; at either end nothing happens (no wrap). Arrow keys are ignored while focus is in a field.
- **Looks:** `--color-bg`, `--radius-lg`, `--shadow-3`, at most `--width-wide` wide and the window less `--space-8`; `::backdrop` in `--color-overlay`.
- **No caching change.** The picture comes from the unchanged picture route with `Cache-Control: no-store`.
- **Video variants** show their still picture, as the gallery holds only stills today (`spec/approvals.md`: video variants are shown by their still). See open question Q-1.

### "Sign off all" (item 20)

`signoff-all` in the sidebar: a primary full-width button "Sign off all…" (`type="button" commandfor="confirm-all" command="show-modal"`) and a muted line under it:

- `reviewer` set, n > 0 left: "{n} left to sign off." (n = live variants not mine).
- `reviewer` set, n = 0: the button is `disabled` and the line reads "You have signed off on every variant."
- `reviewer` null: "Signs every variant shown, as the email above."
- No live variant at all: the button is `disabled`; "Nothing to sign off yet."

The confirmation `<dialog id="confirm-all" aria-labelledby="confirm-all-title">`: title "Sign off all?" (`h2`), text "This signs off on every variant shown that you have not signed yet, as the email under “Signing off as:”. You can remove a sign-off later, one at a time.", then "Cancel" (`command="close"`, `autofocus`) and primary "Sign off all" (`type="submit" form="reviewer" name="all" value="1" formnovalidate`). A confirmation, because one click writes many rows and each must be removed by hand (A-368).

### The app (item 19, R-10)

- `approvals.forCampaign` gives only the sign-offs whose `version` equals the variant's current `rev` (`src/main/queries/approvals.ts`). The field `current` leaves `ApprovalsSignoff`. The local rows stay.
- `approvalMarks` becomes: no link or no entry, none; live link and no row, "Not in the gallery"; n ≥ 1 sign-offs, "Signed off by {n}"; `publishedRev` set and different from `currentRev`, "Changed since published"; otherwise none. "Changed since sign-off" and "Earlier version signed off" go (with the filter, a shown sign-off always matches `currentRev`, so neither can arise).
- The approval bar counts variants in the gallery with at least one sign-off. The sign-off list draws `{email} · {date and time}` only.
- So a variant edited after a sign-off reads as not signed off in the app at once, even before "Update gallery"; the gallery keeps showing the sign-off until the gallery is updated, since it still shows the version that was signed (A-372, Q-3).

### Security rules and the test that proves each

| # | Rule | Test |
|---|---|---|
| S-1 | Every new or changed write route passes the four form checks first; a failure is the `403` and writes nothing, sets no cookie | `test/forms.test.ts`: the table gains `reviewer` and the `one` and `all` forms of `signoffs` (R2A-2, R2A-3) |
| S-2 | The reviewer cookie's attribute text is exact, set only after the session check, never by a page | `test/reviewer.test.ts` (R2A-2); `e2e/gallery.spec.ts` reads the `Set-Cookie` text (R2A-7) |
| S-3 | A bad reviewer cookie (upper case, spaces, `<script>`, 300 letters, another link's name) is null in the view | `test/reviewer.test.ts` |
| S-4 | The password page ignores the reviewer cookie: the same bytes with and without it, for a real and an unknown slug | `test/view.test.ts` row (R2A-2); `e2e/gallery.spec.ts` case 1 with the cookie planted (R2A-7) |
| S-5 | No email in any address: every `303` `Location` matches `^/l/{slug}(\?m=[a-z-]+)?(#v-[2-9a-z]{6})?$` | `test/reviewer.test.ts`, `test/signoff-all.test.ts` over every route and result |
| S-6 | No email in any log line | `test/signoff-all.test.ts`: a throwing database in each new path logs only the route name and the error's name (a spy on `console.error`) |
| S-7 | "Sign off all" writes only the set the page showed: a stale `seen`, a malformed one, an expired picture, a variant changed between the stamp check and the batch (a stand-in `Db` whose batch runs after a replace), another link's variants: no row for them | `test/signoff-all.test.ts` (R2A-3) |
| S-8 | Older sign-offs never reach the view; a sign-off of another link never does | `test/view.test.ts` (R2A-2) |
| S-9 | "Log out" ends the session row and clears both cookies; the reviewer cookie alone opens nothing | `test/session.test.ts`, `test/reviewer.test.ts` (R2A-2) |
| S-10 | The page policy and the picture header set are unchanged | `test/headers.test.ts` (existing assertions, untouched); `e2e/gallery.spec.ts` fails on any policy refusal with script on, and checks every `/p/` reply is `no-store` (R2A-7, R2A-8) |
| S-11 | No outside fetch from the stylesheets | `test/tokens.test.ts` (R2A-4) |
| S-12 | One client component only, and it cannot reach data | `test/config.test.ts`: `'use client'` allowed in the two error boundaries and `src/ui/gallery-script/gallery-script.tsx` only; under `src/ui/gallery-script/` no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `setAttribute`, `import(` (R2A-8) |
| S-13 | Every `action`, `formaction`, `value` of a sign-off button and `src` is built only from the checked slug, a variant key and a whole number from the view; every outside value is a React text child or attribute | `test/ui-*.test.tsx` hostile-text tables (R2A-5, R2A-6, R2A-7) |

Noted, not fixed (nuisance): anyone with the link can press "Sign off all" with a made-up email, as they can sign off one by one today; the rows are removable. A browser that restores its last session may keep the reviewer cookie, as it keeps any session cookie.

## Slices

Every service slice runs its checks from `approvals-service/` and the root lint:

```
cd approvals-service && npm run typecheck && npm test && npm run test:e2e
cd .. && npm run lint
```

(`test:e2e` builds and starts the service itself with `NEXT_TELEMETRY_DISABLED=1`; every address `http://localhost:{port}`; nothing contacts Vercel, a hosted database or a bucket.) App slices run the list in `DEV-RULES.md` "Verify before you say done", with `npm run test:e2e` when the renderer changes.

### R2A-1 — The app hides older sign-offs (R-10)

- **Exists when done:** `approvals.forCampaign` gives only sign-offs for the variant's current `rev`; `current` is gone from the type; the marks, the approval bar, the tile's sign-off list and the dialog's list follow "The app (item 19, R-10)"; no screen says "for an earlier version", "Earlier version signed off" or "Changed since sign-off".
- **New files:** `tests/shots/r2a-1.shots.ts` (`90-r2-app-tile-signed`, `90-r2-app-tile-changed`).
- **May touch:** `src/main/queries/approvals.ts`, `src/shared/schemas/queries/approvals.ts`, `src/shared/approvals/marks.ts`, `src/renderer/screens/campaign/approval-bar/approval-bar.tsx`, `src/renderer/ui/signoff-list/signoff-list.tsx`, the comments in `src/renderer/dialogs/approval-dialog/signoffs-by-variant.tsx` if they name earlier versions.
- **Tests first:** in `tests/integration/approvals/for-campaign.test.ts`, a variant with sign-offs at `rev` 2 and 3 and current `rev` 3 gives only the 3; a variant edited to `rev` 4 after a sign-off at 3 gives none. In `tests/unit/shared/approvals/marks.test.ts`, the new table.
- **Approved edits to existing tests:**
  - `tests/unit/shared/approvals/marks.test.ts`: the rows giving "Changed since sign-off" or "Earlier version signed off" (lines 43 to 58) are replaced by the new table; other rows stay.
  - `tests/unit/renderer/ui/signoff-list.test.tsx`: `current` leaves the fixtures; the "for an earlier version" line (35) becomes the plain line.
  - `tests/unit/renderer/screens/campaign/approval-mark.test.tsx`: line 63's expected text loses " · for an earlier version"; `current` leaves its fixtures.
  - `tests/unit/renderer/stores/approvals-fixture.ts`: `current` leaves both sign-offs (lines 41, 48); the one that was `current: false` is dropped, and any count that test files read from the fixture drops by one where it counted that row.
  - `tests/integration/approvals/for-campaign.test.ts`: lines 109 and 110 become the filtered list.
  - `tests/e2e/approvals.spec.ts`: lines 77 to 93: after the edit the tile shows "Changed since published" and no sign-off; after "Update gallery" no mark names an earlier version and the sign-off list is empty.
- **Exit check:** the `DEV-RULES.md` list and `npm run test:e2e`.
- **Security class:** none (it only shows less). **Depends on:** nothing.

### R2A-2 — Service: the reviewer email and the view

- **Exists when done:** the reviewer cookie, `POST /l/{slug}/reviewer`, "Log out" clearing both cookies, `redirect` with `cookies`, the view with `reviewer` and only current sign-offs, the `email-saved` notice; the card no longer draws an earlier list; the page still works as today otherwise.
- **New files:** `src/visitor/reviewer.ts`; `test/reviewer.test.ts`.
- **May touch:** `src/visitor/actions.ts` (`openGallery`, `leaveLink`, a `saveReviewer` action), `routes.ts` (the new route row, the leave and enter handlers' `cookies`), `headers.ts` (`cookies`), `notices.ts` (`email-saved`); `src/ui/variant-card/variant-card.tsx` (the earlier list goes), `src/ui/gallery-screen/gallery-screen.tsx` (no `earlier`), remove `src/ui/group-signoffs.ts` (its one use inlined as a filter by variant).
- **Tests first:** `test/reviewer.test.ts` (S-2, S-3, S-5, S-9: cookie text exact; set by `/reviewer` with a good email; a bad email sets none and gives `bad-email`; the cookie alone gives the password page; another link's reviewer cookie is not read); `test/view.test.ts` new rows (S-4, S-8).
- **Approved edits to existing tests:**
  - `test/view.test.ts` line 112: the key list becomes `['link', 'notice', 'reviewer', 'signoffs', 'stamp', 'variants']` (R2A-3 adds `stamp`; this slice adds `reviewer` only, so here the list gains `'reviewer'`).
  - `test/headers.test.ts`: the "303 after Leave" case (line 143) expects two `Set-Cookie` headers, the session one then the reviewer one; the `redirect` option tables (around line 232) use `cookies`. Every other header set stays byte-equal.
  - `test/session.test.ts` line 84 case: the cleared session cookie is still checked exactly; a second, reviewer `Set-Cookie` is allowed.
  - `test/routes.test.ts`: any count or list of `VISITOR_ROUTES` grows by the one `reviewer` row.
  - `test/forms.test.ts`: the route table gains `reviewer` with every row `/leave` has.
  - `test/ui.test.tsx`: the `view()` helper gains `reviewer: null`; the "earlier email" escape row (line 72) becomes a check that an older sign-off's email is not drawn at all; "groups current and earlier…" (156 to 171) keeps only its current-group assertions; the `groupSignoffs` test (221 to 232) is removed with the file.
  - `e2e/shots.spec.ts` line 121: the earlier-version expectation goes (the seeded older sign-off stays and must not show).
- **Exit check:** the service checks above.
- **Security class:** full. **Depends on:** nothing.

### R2A-3 — Service: one sign-off and "Sign off all"

- **Exists when done:** the sign-off form takes `one` or `all` as in "Routes and data changes"; `galleryStamp`; `stamp` in the view; `signed-all` and `gallery-changed`; `bad-email` has no anchor; the existing per-card form posts the new shape, so the page keeps working.
- **New files:** `src/visitor/stamp.ts`, `src/visitor/signoff-all.ts` (the `all` path; `signoffs.ts` stays under 200 lines); `test/signoff-all.test.ts`, `test/stamp.test.ts`.
- **May touch:** `src/visitor/signoffs.ts`, `actions.ts` (`stamp` in the view), `notices.ts`; `src/db/signoffs.ts` (a batch helper only; the statement is unchanged); `src/ui/signoff-form/signoff-form.tsx` (the button becomes `name="one" value="{key}.{version}"`; hidden `variant` and `version` go).
- **Tests first:** `test/stamp.test.ts` (fixed set gives a fixed hex; order and expiry matter); `test/signoff-all.test.ts` (S-5, S-6, S-7; all signed in one batch; repeats add nothing; neither or both of `one` and `all` give `changed`).
- **Approved edits to existing tests:**
  - `test/signoffs.test.ts`: the `fields` helper and the field-shape rows (lines 41 to 43, 72, 73, 81, 95, 117, 123 to 128) move to `one = {key}.{version}`; every expected notice and row stays, except that the bad-email case's expected anchor becomes none.
  - `test/forms.test.ts`: `FIELDS` (line 21) gains `one` and `all` and drops `variant` and `version`; the table runs both forms.
  - `test/view.test.ts` line 112 gains `'stamp'`.
  - `test/ui.test.tsx` lines 150 and 151: the hidden inputs become a button with `name="one" value="aaaa22.3"`; `view()` gains `stamp`.
- **Exit check:** the service checks above.
- **Security class:** full. **Depends on:** R2A-2.

### R2A-4 — Service: the app's tokens

- **Exists when done:** `app-tokens.css` (the copy), `gallery-tokens.css`, `base.css`; `tokens.css` removed; every existing component's CSS uses only app or gallery tokens; the password page and the current gallery draw in the app's look. No markup change.
- **New files:** `approvals-service/src/ui/app-tokens.css`, `gallery-tokens.css`, `base.css`; `approvals-service/test/tokens.test.ts`; root `tests/unit/config/approvals-tokens.test.ts`; `approvals-service/e2e/` shot names `98-r2-password`, `98-r2-password-wrong` in a new `e2e/shots-r2.spec.ts`.
- **May touch:** `approvals-service/app/layout.tsx` (the three imports); every `src/ui/*/*.module.css`; remove `src/ui/tokens.css`.
- **Tests first:** both token tests (S-11 and the copy).
- **Approved edits to existing tests:** none.
- **Exit check:** the service checks above, and root `npm test -- tests/unit/config`.
- **Security class:** short (global stylesheet, the policy unchanged). **Depends on:** nothing.

### R2A-5 — Service: the sidebar parts

- **Exists when done:** the server components `reviewer-panel`, `reviewer-form`, `signoff-all` (with its confirmation dialog) and `log-out-form`, each in its own folder with its CSS module, drawn from props only (`slug`, `campaignName`, `reviewer`, `stamp`, `notice`, `left`, `live`). Not yet on the page.
- **New files:** `src/ui/reviewer-panel/`, `src/ui/reviewer-form/`, `src/ui/signoff-all/`, `src/ui/log-out-form/`; `test/ui-sidebar.test.tsx`.
- **May touch:** nothing else.
- **Tests first:** `test/ui-sidebar.test.tsx`: the exact words of "The sidebar" and "Sign off all"; the field's label, `autocomplete`, `required`, `aria-describedby` and, with `bad-email`, `aria-invalid` and `role="alert"`; "Use this email" is the first submit button of the form `reviewer`; the confirmation's submit has `form="reviewer" name="all" value="1" formnovalidate`; each disabled state; hostile campaign name and email escaped (S-13).
- **Approved edits to existing tests:** none.
- **Exit check:** `npm run typecheck && npm test` in `approvals-service/`; root `npm run lint`.
- **Security class:** short. **Depends on:** R2A-4.

### R2A-6 — Service: the card parts and the lightbox

- **Exists when done:** server components `card-signoff` (the full-width button), `signoff-tick`, `lightbox` (with `lightbox-media`, the picture or the expiry sentence, so a later video slice changes one file), and `src/ui/picture-size.ts`, from props only. Not yet on the page.
- **New files:** `src/ui/card-signoff/`, `src/ui/signoff-tick/`, `src/ui/lightbox/`, `src/ui/lightbox-media/`, `src/ui/picture-size.ts`; `test/ui-lightbox.test.tsx`.
- **May touch:** nothing else.
- **Tests first:** `test/ui-lightbox.test.tsx`: the dialog's id, label and `data-lightbox`; Close first with `command="close"`; the three sign-off states and their words; each Remove form's action and name; Previous and Next drawn `hidden`; the picture's `src`, `width` and `height`; `pictureSize` table (spaces or none, too big, no match); hostile title, size line and emails escaped (S-13).
- **Approved edits to existing tests:** none.
- **Exit check:** as R2A-5.
- **Security class:** short. **Depends on:** R2A-4.

### R2A-7 — Service: the gallery page put together

- **Exists when done:** the gallery page is the sidebar plus the masonry of cards with the states, ticks and lightboxes, as "Design additions" says, working with JavaScript off; "Leave" is "Log out"; old components gone; shots taken.
- **New files:** none beyond shots; `e2e/shots-r2.spec.ts` gains `99-r2-gallery` (wide, 1280 × 900: one card needing sign-off, one signed by this reviewer, one signed by another reviewer only, one expired, pictures of three shapes), `99-r2-gallery-phone` (390 × 844), `99-r2-lightbox`, `99-r2-lightbox-phone`, `99-r2-confirm-all`, `99-r2-bad-email`.
- **May touch:** `src/ui/gallery-screen/`, `src/ui/variant-card/`, `src/ui/gallery-grid/`, `src/ui/variant-picture/`, `src/ui/page-shell/` (the two-column frame); remove `src/ui/gallery-header/`, `src/ui/signoff-form/`, `src/ui/signoff-list/`; `app/l/[slug]/page.tsx` only if a prop name changes; `e2e/shots-r2.spec.ts` (made by R2A-4).
- **Tests first:** in `e2e/gallery.spec.ts`, the new flow (below) with JavaScript off and on.
- **Approved edits to existing tests:**
  - `test/ui.test.tsx`: the "gallery page" block (lines 105 to 189) is rewritten for the new page: the title and `h1`, the instructions, the Log out form posting to `/leave`, the notice rows (with `bad-email` and `email-saved` in the sidebar), "Nothing to review yet.", one card per variant in order, the card states, every field labelled. The escape table (64 to 81), the password page (83 to 103), the picture block (191 to 210, the `alt` now empty inside the button) and the fixed pages (235 to 256) keep their assertions.
  - `e2e/gallery.spec.ts`: `signOffFlow` (166 to 181) becomes: enter; type `ann@example.com` under "Signing off as:"; "Sign off: {title}" on one card; the notice and the card's tick; reload keeps the email in the field; open the lightbox from the tick, "Remove sign-off by ann@example.com", the notice; "Sign off all…", "Sign off all", the `signed-all` notice and every live card ticked; "Log out" lands on the password page and the reviewer cookie is cleared. Case 2 (157 to 162): the variant headings and pictures are found inside each `article` (the pictures' alt text moved to the button's name). The rest stays.
  - `e2e/shots.spec.ts`: its gallery steps follow the new words (`Leave` to `Log out`, the email field's label); its picture names stay.
  - `test/config.test.ts`: none here.
- **Exit check:** the service checks above; look at each shot.
- **Security class:** full. **Depends on:** R2A-3, R2A-5, R2A-6.

### R2A-8 — Service: the gallery script

- **Exists when done:** one client component, `src/ui/gallery-script/gallery-script.tsx` (`'use client'`, draws nothing), mounted once by `gallery-screen`, wiring three small modules: `arrow-keys.ts` (arrow keys and the Previous and Next buttons, shown by removing `hidden`; focus back to the variant's picture button when a dialog reached by arrows closes), `command-fallback.ts` (only when `HTMLButtonElement.prototype` has no `commandForElement`: a click on a `[commandfor]` button calls `showModal()` or `close()` on its dialog), `masonry-spans.ts` (only when `CSS.supports('display', 'grid-lanes')` is false: sets `grid-row-end` spans through the style object, again on resize through one `ResizeObserver` and on each picture's `load`).
- **New files:** `src/ui/gallery-script/` (the four files); `test/gallery-script.test.ts` (the pure parts: the next and previous dialog in order, the span count from a height); `e2e/lightbox.spec.ts`.
- **May touch:** `src/ui/gallery-screen/gallery-screen.tsx` (one line), `src/ui/gallery-grid/gallery-grid.module.css` (the fallback grid rule).
- **Check first:** in Playwright's Chromium under `next start`, with script on, the page reports no policy refusal and the spans are applied; stop and report if anything needs a looser policy.
- **Tests first:** `e2e/lightbox.spec.ts`: open from the picture; Escape closes and focus is on the picture button; Tab stays in the dialog; Right and Left move through cards in gallery order and stop at the ends; the picture reply in the lightbox is `no-store`; with script off, the dialog opens and closes and Remove works; no policy refusal.
- **Approved edits to existing tests:** `test/config.test.ts`: the `'use client'` row allows exactly the three files of S-12, and the banned-words row for `src/ui/gallery-script/` is added.
- **Exit check:** the service checks above.
- **Security class:** full (the first script of our own on the page). **Depends on:** R2A-7.

### R2A-9 — The app's local approvals run follows both sides

- **Exists when done:** `tests/approvals-local/approvals-local.spec.ts` follows the new gallery and R-10, and passes with `npm run test:approvals-local` (the app and the service on this machine, no bucket: its own local picture server).
- **New files:** none.
- **May touch:** `tests/approvals-local/approvals-local.spec.ts`, `tests/approvals-local/app-steps.ts`.
- **Approved edits to existing tests:** in `approvals-local.spec.ts`: the visitor signs off through "Signing off as:" and the card's "Sign off: {title}" (96 to 99); after the edit the tile shows "Changed since published" and no sign-off (105 to 110); after "Update gallery" the card needs a sign-off again and no heading "For an earlier version" exists (111 to 122); "Leave" becomes "Log out" where used.
- **Exit check:** `npm run test:approvals-local`, then the full `DEV-RULES.md` list and the service checks once, as the round's full check.
- **Security class:** none. **Depends on:** R2A-1, R2A-8.

## Wave table

At most two developers at once. Slices in one wave own disjoint files.

| Wave | Slices | Why together |
|---|---|---|
| 1 | R2A-1 and R2A-2 | App files against `approvals-service/src/visitor/` and the card |
| 2 | R2A-3 and R2A-4 | Visitor logic against stylesheets (R2A-4 touches no markup and no test that R2A-3 edits) |
| 3 | R2A-5 and R2A-6 | New folders only, each its own test file |
| 4 | R2A-7 | Puts the page together |
| 5 | R2A-8 | The script needs the assembled page |
| 6 | R2A-9 | Both sides done; the round's full check |

## Assumptions (A-360 to A-379)

- **A-360.** The reviewer email lives in a cookie with no `Max-Age` (a browser-session cookie), not in browser storage: the server must know it to draw each card's state with script off, and `HttpOnly` keeps it from scripts.
- **A-361.** The cookie is cleared by "Log out" and by every right password entry (the entry reply sets the session cookie, then the cleared reviewer cookie), so a later person on a shared browser never signs off under an earlier person's email. A reviewer whose session is still live finds their email still there. A wrong password sets no cookie.
- **A-362.** Every sign-off uses the posted field text; the cookie only fills the field and marks the cards.
- **A-363.** "Use this email" exists so Enter in the field saves the email and can never press "Sign off all".
- **A-364.** "Sign off all" is one request carrying a stamp of the shown set; a stale stamp writes nothing.
- **A-365.** "Sign off all" leaves out variants whose picture has expired; the page offers no sign-off button on an expired card either, though the server still accepts a single sign-off for one (unchanged rule).
- **A-366.** Other reviewers' sign-offs show as a count on the card ("Signed off by {n}") and in full, with Remove, in the lightbox.
- **A-367.** Remove lives only in the lightbox, reached from the picture or the tick.
- **A-368.** "Sign off all" asks for confirmation in a dialog.
- **A-369.** The lightbox and the confirmation use HTML's own command buttons and `<dialog>`, which need no script in current browsers; older browsers get a script fallback.
- **A-370.** Masonry is CSS grid lanes where the browser has it, a script fallback where not, and a plain top-aligned grid with script off. Multi-column is not used because it breaks the order.
- **A-371.** Picture shapes come from the size line's "{width}×{height}", parsed in the service; no contract change.
- **A-372.** In the app a sign-off shows only for the variant's current `rev`, so an edit not yet sent to the gallery already reads as not signed off; "Changed since sign-off" and "Earlier version signed off" go.
- **A-373.** The instructions are a fixed sentence written by us, not text from the campaign.
- **A-374.** Video variants stay stills in the gallery and its lightbox this round.
- **A-375.** The route path `/leave` stays; only its button's words change.
- **A-376.** A page drawn before the change that posts the old `variant` and `version` fields gets "changed" and writes nothing.
- **A-377.** The app's token file is copied byte for byte and kept in step by a root test, as the contract is.
- **A-378.** On the gallery, buttons and fields are 44px tall and fields use 16px text (phone use), larger than the app's own controls; every other value is the app's.
- **A-379.** A card that needs this reviewer's sign-off has an accent edge and a raised shadow; a signed one has a quiet edge and a soft ground with the green tick; each state also has words.

## Open questions

- **Q-1. Video in the lightbox.** Today the gallery holds only stills (a video variant shows its first frame). Playing the real clip needs the app to upload clips, the service to check and stream video (with byte-range replies for Safari), a higher size cap, and `media-src 'self'` added to the page policy (our own address only). **Recommendation:** leave it for a later round; this round shows the still, with the picture part in one component (`lightbox-media`) so the change touches one place. Planned that way.
- **Q-2. "Instructions" in the sidebar.** A fixed sentence from us, or a note per campaign typed in the app's approval dialog (a contract and app change)? **Recommendation:** the fixed sentence now; a per-campaign note later if reviewers need direction. Planned for the fixed sentence.
- **Q-3. An edit not yet sent to the gallery.** With R-10 as planned, the app shows a variant as not signed off as soon as it is edited, while the gallery still shows the sign-off on the old picture until "Update gallery". The alternative keeps "Signed off by {n}" with "Changed since sign-off" in the app until the gallery is updated. **Recommendation:** as planned (the app tells the truth about the design you now hold). Planned that way.
