# Approvals by link

A way to get sign-off on variants from people outside the app [D-095]. The user makes a password-protected link per campaign; a visitor opens it, enters the password, sees the campaign's variants and signs off on one with an email address; the sign-offs show in the app. Opt-in: nothing happens until the user sets up a service and makes a link.

**State.** Built, slices AP-1 to AP-16: the service and its gallery pages, the desktop contracts, the service client, service settings and kept passwords, the picture store, the Settings section, the link commands and queries, "Update gallery" and refresh, the campaign page parts and the local proof. Round 2 is built too: the app hides older sign-offs, the gallery is a sidebar beside a masonry of cards with a lightbox each (R2A-1 to R2A-9), and video variants play in the gallery (R2V-1 to R2V-8). Its design is in `spec/phases/round-2-approvals.md` and `round-2-approvals-video.md`. Two accepted gaps are noted where they apply.

**Round 2, in short.**

- The app shows a sign-off only for the variant's current version; an edit not yet sent to the gallery already reads as not signed off.
- The gallery page is a sidebar (campaign title, a fixed instruction sentence, "Signing off as:" with the reviewer's email, "Sign off all…", "Log out") beside a masonry of variant cards. A card that needs this reviewer's sign-off stands out; a signed one shows a green tick. Each card opens a lightbox with the large picture or video and its sign-off button. It works with script off; one small script of the service's own adds arrow keys between lightboxes, masonry spans where the browser lacks them, and pausing a video when its lightbox closes.
- The reviewer's email is kept in a browser-session cookie (`HttpOnly`) to fill the field and mark the cards. "Log out" clears it, and so does every right password entry, so a later person on a shared browser never signs off as an earlier one. "Sign off all" signs only the set the page showed.
- **Video.** "Update gallery" exports each changed video variant to MP4 with the video export code and uploads it to the user's bucket beside its still (the still is the poster). The clip reaches a reviewer only through the service, after the password, one byte range at a time, at `/l/{slug}/c/{variantKey}/{version}`, and plays in the lightbox with the browser's own player (no autoplay, no download). The page policy gained `media-src 'self'`. A clip over 3 minutes or 384 MiB, or a machine without FFmpeg, sends the still with a note. The contract is version 2; the keyed API's body cap is 4 MiB.
- **"Update gallery"** shows its progress as a bar (`approvals.progress`) and can be stopped (`approvals.cancelUpdate`, denied to agents). The dialog can be closed while it runs and the update goes on (D-110; "An update in the background" below). One run per campaign at a time. A failed or stopped run removes only the files it added.

**Where things are.**

- This file: how it fits together, Settings, versions and marks, screens, security rules, open items, assumptions A-82 to A-109, what is left for later.
- `spec/approvals-client.md`: the service client, the local tables, kept passwords, pictures.
- `spec/approvals-commands.md`: the commands, the queries and the event.
- The service itself (Next.js on Vercel, D-097): `spec/approvals-service.md` (how it is built, tooling, environment, deploying), `spec/approvals-service-data.md` (the contract, database, passwords, keyed API), `spec/approvals-service-visitor.md` (visitor routes, sessions, forms, pictures on its side), `spec/approvals-service-tests.md`. The visitor's pages: `spec/approvals-gallery.md`.
- Slices: `spec/phases/approvals.md` (rules and order), `spec/phases/approvals-desktop-slices.md`, `spec/phases/approvals-service-slices.md` (AP-1 to AP-16).

## How it fits together

```
Desktop app (main process)                       Next.js service (Vercel) + db     Visitor's browser
  Settings: service address, key  ── HTTPS + key ──>  /api/v1/...                        
  "Update gallery":                                                                  
    render each variant (render service)                                              
    upload PNG to the user's S3 bucket                                                 
    sign a read address (7 days)  ── gallery + addresses ──>  stores rows              
  "Refresh" / timer  <── sign-offs ──  /api/v1/links/...                               
                                       /l/{slug}  <── password, sign-off forms ──  visitor
                                       fetches the picture from S3 ──> passes it on to visitor
```

- The app talks only to the service, never to its database [D-095, A-82].
- The pictures live in the user's S3 bucket ("that's one layer covered"); the visitor never sees the bucket address.
- A link belongs to one campaign. The service finds it by the project ID and campaign ID (A-84).
- Nothing in this feature runs, sends or publishes until the user presses a button. The background refresh only reads.

## Settings

**Built** (AP-5, AP-6).

### The service address

- `settings.json` gains `approvals: { baseUrl: string | null }`, default `{ baseUrl: null }` (`src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`).
- **One writer:** `approvals.setService`. `settings.update` refuses the key (its strict schema does not list it). Security class.
- **The rule** (`parseApprovalsAddress(text, { allowLocalHttp })`, `src/shared/approvals/address.ts`, pure): trimmed; parsed as a URL; scheme `https:`; a host name with at least one dot that is not an IP address (v4 or v6) and not `localhost`; no user name or password; nothing after the host and port but at most one `/`. Stored as the origin (`https://host` or `https://host:port`). Anything else is refused with "Enter an address that starts with https:// and has a host name, with nothing after it."
- **Local test exception.** With `allowLocalHttp: true`, exactly `http://127.0.0.1:{port}` is also accepted. The main process passes `deps.devTools` (true only in an unpackaged app started with `ADMAN_DEV_TOOLS=1`). A packaged app never accepts plain `http`.
- **On load** (`settings-store.ts`): an address that fails the rule (with `allowLocalHttp: false`, since the store does not know about dev tools) is read as null; the refused text is kept nowhere; the next save writes null. The same rule as `comfyui.baseUrl` (`spec/infra-and-settings.md`, "Loading the file"). A local test address is therefore set again by the test at each start. Accepted, not built: the saved address is loaded without the dev-tools flag check (`spec/approvals-client.md`, "The service client").
- `__proto__` inside `approvals` adds nothing (the existing `merge` rule).

### The key

- Secret name `approvals.apiKey`, added to `SECRET_NAMES` (`src/shared/schemas/secrets.ts`), stored in `secrets.bin` like every key. Saved with the existing `secret.set` (agents denied).
- It leaves the main process only inside the `Authorization` header of a request to the saved address. Never in a project file, a log line, an error, an event, an MCP reply, or a query reply. `app.getState` lists it by its last four characters, like every other key (A-98).

### Cloud storage: the S3 part

The gallery needs a bucket. This feature builds the **S3 part** of Settings' "Cloud storage" ahead of Phase 9 (A-95). Built (AP-10a); "Test connection" is AP-10b (built). Both are written in `spec/storage-and-publish.md`, "Storage settings screen". Phase 9 adds Dropbox to the same section.

## Versions and marks

A variant's version is its `rev` (A-91). It changes with every saved edit of the variant or its layers, and with nothing else.

`approvalMarks(entry, linkState)` (`src/shared/approvals/marks.ts`, pure) gives a tile's marks:

| Situation | Mark |
|-----------|------|
| No link, or the variant has no row and no sign-off | none |
| Live link, the variant was never published | "Not in the gallery" |
| n sign-offs for the variant's current `rev` (n ≥ 1) | "Signed off by {n}" |
| Published, and `currentRev` differs from `publishedRev` | "Changed since published" |

The first row that applies gives the mark.

A sign-off belongs to the version it was given for. **The app shows a sign-off only for the variant's current `rev`** (R2A-1, A-372): an edit not yet sent to the gallery already reads as not signed off, and sign-offs of older versions are hidden in the app and in the gallery. "Changed since sign-off" and "Earlier version signed off" are gone.

## Screens

D-084: one folder per component, CSS from the existing tokens only (no slice of this feature adds a token), data by props or a store. Shots in `tests/shots/ap-*.shots.ts`, pictures numbered 90 to 99. All text from the service (emails) and from the project is drawn as text.

### Settings

- **"Approvals service"** (`src/renderer/screens/settings/approvals-section/`, **Built**, AP-10):
  - The line "Share a campaign's variants with a password-protected link and see who signed off. The service runs on your own Vercel account."
  - A "Service address" field, starting with the saved address, with "Save" and "Remove" (`approvals.setService` with `{ address }`; Remove sends `{ address: null }`; a refusal's sentence under the field).
  - The key row, labelled "Service API key" (the shared key row makes the label): `secret.set` and `secret.delete` with `approvals.apiKey`, last four shown, the field is a password field.
  - "Test connection" (`approvals.check`). It can be pressed with nothing set up, and then shows the `approvals_not_set_up` sentence. A "Testing…" line shows while it waits; then "Connected." or the failure's sentence. Saving or removing the address clears an old result.
  - The line "Pictures for the gallery are kept in your Amazon S3 bucket (Cloud storage, above)."
- **"Cloud storage"** (`s3-section/`): see "Cloud storage: the S3 part", above.
- Mounted in `settings-screen.tsx` after the keys section: Cloud storage, then Approvals service.

### The campaign page

**Built** (AP-11, AP-12).

- **Approval bar** (`src/renderer/screens/campaign/approval-bar/`), in the page's header row: the button "Approval link…". With a live link: "Signed off: {a} of {b} variants" (variants with at least one current sign-off, of those in the gallery), "Checked {time}" and a "Refresh" button. After a failed refresh: the failure's sentence in place of "Checked". With an ended link: "Link turned off".
- **Store** (`src/renderer/stores/approvals-store.ts`, one per campaign page): holds the `approvals.forCampaign` reply; reads it again on `approvals.changed` for its campaign and on `project.changed` for its project (revs change the marks). While the link is live and `ready` is `ready`, it sends `approvals.refresh`: once when the page opens, every 60 seconds while the window has focus, when the window gains focus, and on "Refresh" (A-92). One refresh at a time; a refresh asked for while one runs is dropped. The background refresh goes through `api.command` directly and shows its failure only in the bar, never in the error banner. A reply with `gone: true` shows the `approval_link_gone` sentence in the bar; the `approvals.changed` event that came with it reads the query again. The timer stops when the page closes.
- **Tile marks** (`src/renderer/screens/campaign/approval-mark/`): under each tile, beside it and not inside the tile's button, the marks of `approvalMarks` and, when the variant has sign-offs, a "Sign-offs ({n})" toggle (`aria-expanded`) showing the list. `VariantTile` gains an optional `footer` prop drawn after the button; `VariantGrid` gains an optional `tileFooter(variant)` prop; both a few lines.
- **Sign-off list** (`src/renderer/ui/signoff-list/`): one line per sign-off for the current version, newest first: "{email} · {date and time}". Used by the tile and the dialog.

### The approval link dialog

**Built** (AP-11). `src/renderer/dialogs/approval-dialog/`, on the dialog frame. Title "Approval link". All buttons that send are disabled while a command runs, with "Working…" beside them.

- **Not ready.** `no_service`: "Set up the approvals service in Settings to make links." `no_bucket`: the `approvals_needs_bucket` sentence. Button "Open Settings".
- **No link.** "Make a link that shows this campaign's variants to reviewers. They need the link and the password. Anyone who has both can sign off on a variant with their email address, or remove a sign-off." Two choices: "Make a password for me" (default) and "Choose a password" (a password field, "At least 12 characters."). Button "Make link": `approvals.createLink`, then `approvals.publish`.
- **Live link.**
  - "Link": the address in a read-only field, "Copy link".
  - "Password": "Copy password" (reads `approvals.getPassword` on click, copies, shows "Copied."; the password is never drawn), or, when not kept, "The password is kept on the computer that made the link." Then "Set a new password…": the two choices again and "People who already opened the link must enter the new password." Button "Set password".
  - "Gallery": "Updated {time}." and "{n} variants changed since." when n > 0. Button "Update gallery" (`approvals.publish`). While it runs it shows a progress bar with a line above it (each picture, then making and sending each clip, from `approvals.progress`), a "Stop" button (`approvals.cancelUpdate`) and "You can close this dialog. The update keeps going." (D-110). A video variant sent as its still (too long, too large, or no FFmpeg) gets a note.
  - The sign-off list of every variant, by variant title.
  - "Turn off link…" opens a confirmation: "Turn off this link? Reviewers can no longer open it. The gallery and its pictures are deleted from the service and your bucket. Sign-offs so far stay in this project." Buttons "Keep link" (focused) and "Turn off link".
  - "If you delete this campaign, turn its link off first." (A-100)
- **Ended link.** "This link was turned off on {date}. Its sign-offs are kept below." Button "Make a new link" with "Sign-offs from the old link will be removed from this project."
- Copy uses `navigator.clipboard.writeText` on click (the one permission the app allows).

### An update in the background (D-110)

The update itself runs in the main process, and other commands are not held while it runs. Only the dialog used to wait for it. Now:

- **The state has one owner in the window.** Whether a campaign's update is running, its latest `approvals.progress` and whether "Stop" was pressed are held outside the dialog, per `{projectId, campaignId}`, so they survive the dialog closing and the campaign page being left and shown again while the project stays open. The update is started and stopped through that owner, and still sent through the app store's command (so `NEEDS_KEY` asks for the key and a refusal reaches the banner).
- **The dialog while an update runs.** The frame can be closed and "Close" is enabled. Every button that sends ("Update gallery", "Set password", "Turn off…", "Make a new link", "Make link") stays disabled. In place of the waiting line: a line of words, the `JobProgress` bar under it (`value` = `unitsDone / unitsTotal`, or no value before the first event and when `unitsTotal` is 0; its button is "Stop"), then "You can close this dialog. The update keeps going." Reopened while the update runs, the dialog shows the same bar at its latest value. Any other command still keeps the frame closed with "Working…", as before.
- **The line of words.** "Sending picture {done + 1} of {total}…" (`drawing`), "Making video {done + 1} of {total}…", "Sending video {done + 1} of {total}…", "Finishing…", "Updating the gallery…" before the first event, and "Stopping…" once "Stop" is pressed (the button is then disabled).
- **The campaign page while an update runs.** The "Approvals" button shows the `spinner` icon in place of `link`, and its name and tip are "Approvals: updating the gallery". A click opens the dialog as always.
- **When it ends with the dialog closed.** Success: the button returns to its usual look, and the tip and the dialog show the new "Updated {time}." through `approvals.changed`. A failure or a stop: its sentence goes to the banner, as every refusal sent through the app store does, and is in the dialog's alert when the dialog is opened next (until another command is sent).
- **Not changed.** One run per campaign (`update_running`); `approvals.cancelUpdate`; the agent policy (both commands stay `deny`); what a stop removes. A project closed or an app quit during an update ends it the way a failed `run` does today: the next "Update gallery" draws what the local rows call changed and sends the whole gallery again.
- **As built.** The owner is `src/renderer/stores/gallery-updates.ts`, a part of the app store (`updates`, `updateGallery`, `stopUpdate`, `clearRefusal`); the campaign's approvals store could not hold it, because it is dropped when the campaign page is left. A failed update's sentence stays in the owner's entry until the dialog sends another command or a new update starts. The bar is named "Updating the gallery" for a screen reader. While updating, the "Approvals" button keeps its "{a}/{b}" mark. The bar has no value when an event carries no unit count. The main process counts units in `src/main/approvals/progress-counter.ts`.
- **Known edge.** With the dialog closed the user can edit. A video variant edited while its clip is being made fails the update with the variant-changed sentence; a still edited after it was drawn is simply counted in "{n} variants changed since."

## Security

Project rule: in scope are attacks that destroy, that reach sensitive data, or that give unexpected power; nuisance is noted at most (`spec/security.md`, "Scope"). This feature sends work out of the machine and holds other people's email addresses, so most of its slices are security class. These rules live here because `spec/security.md` is at its size limit; that file should point here when it is next split.

### Threats

| Threat | What stops it |
|--------|---------------|
| Guessing a slug | 12 letters from 62 (about 3 × 10^21). A slug alone opens only the password page, the same page an unknown slug gets |
| Guessing a password | PBKDF2-SHA-256, 100,000 iterations, salted per link; 10 tries per link per 15 minutes; the app's made password is about 79 bits; a chosen one has at least 12 characters (A-86) |
| A copy of the service's database | Passwords only as slow salted hashes; sessions only as hashes; picture addresses run out within 7 days and hold no secret key |
| The service key stolen | It controls every link on that service: read emails, change or delete galleries, set picture addresses (only S3 hosts are fetched). Kept only in `secrets.bin` and the service's `API_KEY` setting (Sensitive, in Vercel); never in a project, log, event, reply or the window beyond the last four. Replaced by a new `API_KEY` in Vercel, a redeploy, and the new key in Settings |
| A visitor's text run as script (on the page or in the app) | Every value drawn as React text (escaped), no `dangerouslySetInnerHTML`; pages run only our own scripts under a new nonce per request and a policy that allows no other origin; emails ASCII only; the app draws every value as text |
| Another site sending forms as a visitor | `SameSite=Lax` cookie; `Origin` must equal the service's own; `Sec-Fetch-Site`; form content type; `frame-ancestors 'none'` |
| The service made to fetch addresses it should not | Addresses come only through the keyed API; `https` and the two S3 host forms only; no redirects followed; size and picture-type checks; the test origin only when a test sets it |
| The app made to send the key to a machine on the user's own network | The resolved address is checked before connecting (loopback and private ranges refused, IPv6 forms judged by their IPv4 inside); the socket is pinned to the checked address (`spec/approvals-client.md`, "The service client") |
| Another campaign's data read through a link | The session names its link; every query filters by that link; the picture route checks link, variant and version; API routes are keyed by project and campaign |
| The slug leaking through `Referer` | `Referrer-Policy: same-origin` (no referrer to any other site); the pages load nothing from elsewhere |
| A visitor's session stolen | `__Host-` cookie, `HttpOnly`, `Secure`, 12 hours; ended by "Log out" (route `/leave`), a new password, or turning the link off |
| A later person on a shared browser signing off as an earlier one | The reviewer-email cookie is a browser-session cookie, `HttpOnly`; "Log out" and every right password entry clear it; every sign-off uses the posted field text |
| The bucket address or keys reaching a visitor | The service fetches the picture or clip and passes on only its bytes (a clip one byte range at a time, at most 4 MiB a reply); the signed address stays in its database |
| A shared project file carrying a link | It carries the slug, the publish state and sign-off emails; never the password, the key or the service address. Another person needs the service key to act on the link |
| A hostile project file steering requests | Every project-file value below is checked before it reaches a request or a storage path |
| The key sent to the wrong place | `https` only, no redirects, the address set only by the user through one command agents cannot send |
| An agent publishing work or reading emails | Every approvals command deny; both queries user only; no tool returns approvals data |

### Project-file values that reach a request or a path

To be added to the table in `spec/security.md`, "Project-file values that reach a path, a header or a request", when that file is next edited.

| Value from the project file | Where it goes | File | Check before use | Left open |
|---|---|---|---|---|
| `project_id`, `campaign.id` | API path `/api/v1/links/{p}/{c}`; picture folder | `src/main/approvals/client.ts`, `picture-paths.ts` | `PROJECT_ID`, `CAMPAIGN_ID` rules | A file copying another project's IDs reaches that link only with the same service key (accepted) |
| `approval_variant.variant_id`, `published_rev` | Picture file name; signing; removal | `picture-paths.ts` | Variant ID rule, whole number; only inside the campaign's folder | None |
| `approval_link.slug` | The link address shown and copied | `src/main/queries/approvals.ts` | `SLUG` rule; a failing row is skipped | None |
| `approval_signoff.*` | Shown in the window | `local-store.ts` | Zod on read (`EMAIL`, IDs, numbers, time) | None |
| `campaign.name`, `variant.title` | Sent to the service, shown to visitors | `publish.ts` | `SHOWN_TEXT` (control and direction characters refused, length); escaped by the service | Names are the user's own words, sent on purpose |

### Rules a developer must not break

- No approvals command or query is ever `allow`, `ask` or `tick` without a ruling. No MCP tool returns approvals data, a slug or a link address.
- The key, a password, a signed picture address, a slug and an email never appear in a log line, an error message, an event, or a test's output. Logs hold IDs, counts, route names and error kinds.
- `approvals.baseUrl` has one writer; the address rule refuses plain `http` except the dev-tools test case.
- No redirect is followed by the client or by the service's picture fetch.
- Picture storage touches only `adman-approvals/{projectId}/{campaignId}/`.
- Visitor pages run only our own scripts under the nonce policy (the framework's and one small gallery script of the service's own), need no script to sign off, and load nothing from another company; the page policy is the built one plus `media-src 'self'`; their policy and headers are checked whole in tests (`spec/approvals-gallery.md`).
- Data at rest: emails and slugs sit in the project file unencrypted, like all project data. Passwords sit in `approval-passwords.bin`, encrypted.

### Accepted, noted

- A visitor who has the link can lock other reviewers out for 15 minutes at a time (nuisance).
- Anyone with the link and password sees every email that signed off, and can remove any sign-off [D-095].
- A campaign deleted with a live link leaves the link and its pictures in place (A-100).
- Many sign-offs or a very large gallery make pages slow (nuisance; 500 variants is a contract limit, not a protection).
- Sign-off emails travel with a shared or packaged project file.

### Named tests

| Test | What it proves |
|------|----------------|
| `tests/unit/shared/approvals/address.test.ts` | Table: `https` origins pass and are stored as origins; `http`, IP addresses, `localhost`, a path, a query, user info, a single-label host refused; `http://127.0.0.1:{port}` only with `allowLocalHttp` |
| `tests/unit/main/settings/settings-store-approvals.test.ts` | A failing address loads as null and is wiped at the next save; `__proto__` in `approvals` adds nothing |
| `tests/integration/approvals/client.test.ts` | Against the stand-in: the key only in `Authorization`; a redirect not followed; a 5 MiB reply refused; a reply of the wrong shape is `other`; the stand-in on plain `http` refused without dev tools; no log line holds the key, address or a body |
| `tests/integration/approvals/client-network.test.ts` | An address resolving to a loopback or private range, or to an IPv6 form carrying one, is refused before connecting; the socket uses the checked address; the TLS server name is the saved host |
| `tests/integration/approvals/picture-paths.test.ts` | Bad IDs refused before any call; a publish and an end touch nothing outside the campaign's folder (a test store over a temporary folder with a file planted beside it) |
| `tests/unit/main/providers/s3/signed-url.test.ts` | The signed address's host is one of `s3Hosts`; it writes back to the same text; only its own query names and the two allowed extras; the credential ends with the region's scope; 604,801 seconds refused; the secret key is not in the address |
| `tests/integration/approvals/agent-denied.test.ts` | Every approvals command as the agent: `AGENT_DENIED`, nothing sent to the stand-in; both queries refuse the agent |
| `tests/integration/mcp/secret-leak.test.ts` (approved addition) | The approvals address, key and a sign-off email planted: none appears in any tool reply |
| `tests/unit/config/approvals-contract.test.ts` | The two contract files are byte-equal; the two `zod` versions are equal |
| Service tests | `spec/approvals-service-tests.md` |

## Open items

- **`createLink` without secure storage.** If the computer cannot store passwords securely, `createLink` (AP-8 as built) fails only after the service made the link, and each retry repeats that; `setPassword` changes the password on the service and keeps it nowhere. **Ruled:** both commands ask the password store whether encryption is available before anything is sent, and refuse with its sentence "This computer cannot store keys securely." (`spec/approvals-commands.md`, "Refusals"). Built with AP-8's review fixes.
- **`setPassword`'s gone sentence.** On a `404`, `setPassword` refuses with `approval_link_gone` and changes nothing locally, but that reason's sentence says the link "is shown as turned off". The link is shown as turned off only after the next refresh. To be checked against the built sentence and worded for this case if needed.
- **No word on a take-over.** On a `409` take-over the user is not told the campaign already had a link. Accepted (A-84).
- **Sign-offs in a received project file** show as real until the next refresh.
- **Two `createLink` calls at once** can keep the wrong password.

## Assumptions

Made to keep the build moving under D-082. Each says how hard it is to undo.

- **A-82. One service, the app never touches the database.** One Next.js service on Vercel with a Turso database holds links, hashed passwords, gallery rows, sign-offs and sessions; the app talks to it over HTTPS with one key. *AP-1. Change later: hard.*
- **A-83. The contract is shared by a byte-equal copy** checked by a root test, so neither build imports the other's code. *AP-1. Easy.*
- **A-84. Links are found by project ID and campaign ID,** one per campaign; a copy of a project on another computer with the same service manages the same link. *AP-2, AP-8. Medium.*
- **A-85. The password is kept** in `{userData}/approval-passwords.bin`, encrypted, never in the project file; the app makes one by default (16 letters in four groups); a chosen one has 12 to 128 characters. *AP-6, AP-8. Easy.*
- **A-86. Password checks:** PBKDF2-SHA-256 at 100,000 iterations, 10 tries per link per 15 minutes, one reply for unknown slug, wrong password and too many tries. *AP-2, AP-3. Easy.*
- **A-87. Sessions** are rows in the service's database with a 12-hour `__Host-` cookie per link, `SameSite=Lax`; a new password or turning off ends them. *AP-3. Easy.*
- **A-88. No script needed on the visitor pages:** plain forms and `303` redirects. Since D-097 the pages load the framework's own scripts under a nonce policy, but signing off works with script switched off. *AP-3, AP-16. Easy.*
- **A-89. Pictures:** a 1,600 px PNG per variant in the user's S3 bucket, signed for 7 days, renewed by refresh when under 2 days remain; the service fetches only S3 hosts; a picture store of the service's own may replace this behind `PictureSource` (OI-96). *AP-4, AP-7, AP-9. Medium.*
- **A-90. "Update gallery" is a command, not a job,** all or nothing, and draws only variants that changed. *AP-9. Medium (a job kind needs a migration).*
- **A-91. A variant's version is its `rev`.** *AP-9. Easy.*
- **A-92. Reading sign-offs back:** a full replace on each refresh; every 60 s while the campaign page is shown and the window has focus, on focus, and on "Refresh". *AP-9, AP-11. Easy.*
- **A-93. Approval tables are main-only side tables,** not wire rows, with their own event; emails travel in the project file. *AP-5. Medium.*
- **A-94. Turning a link off** deletes it, its gallery, sign-offs and sessions on the service and its pictures in the bucket; the app keeps its last read of sign-offs until a new link is made. *AP-8. Easy.*
- **A-95. The S3 part of Settings' "Cloud storage"** is built ahead of Phase 9 (OI-97). *AP-10a (built); AP-10b.*
- **A-96. Agents:** every approvals command deny, both queries user only. *AP-5. Easy.*
- **A-97. Local test doors:** plain `http` to `127.0.0.1` and a folder picture store only in an unpackaged app with dev tools on; the service's `TEST_PICTURE_ORIGIN` only in tests. *AP-6, AP-7, AP-4. Easy.*
- **A-98. The service key shows its last four** characters like every other key, not only "set / not set". *AP-5. Easy.*
- **A-99. Emails are ASCII only** and shown to every visitor (OI-95). *AP-1. Easy.*
- **A-100. Deleting a campaign leaves its link** on the service; the dialog says to turn it off first. *AP-11. Easy.*
- **A-101. One router for everything but the page.** A root catch-all Next.js route handler hands every request except `GET /l/{slug}` to the reviewed `createApp`, so the keyed API, form posts, pictures and the 404 keep one route table and their tests. *AP-14. Easy.*
- **A-102. Turso (libSQL) is the database,** through a thin `Db` interface shaped like the calls the reviewed code made, so the migration and queries run unchanged. *AP-14. Medium (Postgres would mean rewriting every query).*
- **A-103. Every form post ends in a `303`,** a failed entry included (to `?m=wrong-password`), so route handlers return only text, redirects and pictures, and only Next.js pages draw HTML. Forms are urlencoded route-handler posts, never Server Actions. *AP-15. Easy.*
- **A-104. `proxy.ts` makes the page nonce and policy and nothing else;** the try limit, session and form checks live only in the service logic. *AP-16. Easy.*
- **A-105. Pictures are sent as a stream** after every check on the whole buffered body, since Vercel limits whole replies to 4.5 MB. *AP-4. Easy.*
- **A-106. The test picture origin is ignored on every Vercel deployment** (`VERCEL` set), on top of the exact `127.0.0.1` rule. *AP-14. Easy.*
- **A-107. Migrations run from the stakeholder's machine** with `npm run db:migrate -- --hosted`; agents never pass `--hosted`. *AP-14, AP-13. Easy.*
- **A-108. Only the production domain is public.** Standard Deployment Protection keeps previews and deployment addresses private, and the database is connected for Production only, so a preview has no data. *AP-13. Easy.*
- **A-109. No client components** except the two error boundaries Next.js requires. Since R2A-8 one small plain script of the service's own improves the gallery (arrow keys, masonry spans, a fallback for browsers without command buttons, pausing videos); nothing needs it to sign off. *AP-16, R2A-8. Easy.*

## Left for later

- **A picture store of the service's own instead of S3** (no 7-day limit, no bucket setup): a new `PictureSource` in the service and a new picture store in the app (OI-96).
- **Script that improves the pages** (for example signing off without a page reload), never needed to sign off (A-109).
- **A job** for galleries of hundreds of variants ("Update gallery" stays a command; since R2V-7 it shows progress and can be stopped).
- **Links of deleted campaigns:** a list in Settings to turn them off.
- **MCP tools** for approvals, if ever (Phase 10 decides; deny until then).
- Comments with a sign-off, links that end on a date, international email addresses. (The reviewer's email is now kept for the browser session, R2A-2.)
