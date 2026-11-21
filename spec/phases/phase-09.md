# Phase 9 — Cloud publishing

Bullets carry `[logic]` (main process, shared code, commands, queries, data, providers) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** A campaign's deliverables and components in S3 or Dropbox.
**Class:** E, D

Already built in Phase 2 and not repeated here: the storage interface, local storage, S3, the Azure stub, and the cloud storage settings values.

## Scope

- [logic] Dropbox with browser sign-in (slice G, below).
- [logic] Publish flow: inspect (existing files and component list), fresh export, component collection, upload, manifest, stale cleanup.
- [logic] The `font_publish_allowed` flag.
- [logic] Each publish writes its date and time, and which publish of the campaign it is, at the top of the published report. The count comes from the manifest it replaces [REQ: FR-241].
- [logic] Remove the hand-test command `dev.storage` and the hand-test screen, once the publish dialog and the storage settings screen exist (details below).
- [UI] Publish dialog with the replace warning and the file list. The warning also says that someone may be reviewing the files being replaced [REQ: FR-241].
- [UI] Font sharing checkbox, cloud storage settings screen.

## Exit criteria

- The named test for campaign folder isolation passes against a fake storage.
- A hand-run publish to a real S3 bucket and a real Dropbox folder shows the documented layout. The stakeholder runs it, with his own keys.

## Dependencies

- Phase 8.
- The Dropbox app key is supplied, and its registration settings are confirmed (OI-18; `spec/storage-and-publish.md`). Phase 9 logic is not held open for it; only the hand proof waits.

## Carried in from earlier work

### Slice G — Dropbox storage and sign-in

- **Class:** E. **Security class** (tokens).
- **Done when:**
  - `src/main/providers/dropbox/` (today an empty `adapters` object) holds a Dropbox `StorageProvider` that meets the shared storage rules: the path rules in `src/main/providers/storage-paths.ts`, the exact message "Storage path refused", `redactSecret` on every failure, and the `list` rules (`a` and `a/` are the same; `a` does not list `ab.txt`; an empty prefix lists everything; files only; each listed path is readable).
  - PKCE browser sign-in, with a listener on `127.0.0.1` at `DROPBOX_SIGN_IN_PORT`, imported from `src/main/providers/dropbox/sign-in-port.ts`. Slice G writes no port number of its own. The listener is open only while a sign-in waits, and checks the `state` value. The browser is opened through `openExternal` (`https:` only).
  - Commands `storage.dropboxSignIn` and `storage.dropboxSignOut` in `src/main/commands/storage/` (today `index.ts` returns `[]`). Both are `deny` for the agent; the rows already exist in `agent-policy.ts`. `storage.dropboxSignIn` returns `{ accountName }`; the hand-test button already reads it.
  - Tested against recorded responses and a local stand-in for the token address.
  - Sets `HAND_TEST_DROPBOX = true` in `src/shared/config/dev-tools.ts`. The screen test "while `HAND_TEST_DROPBOX` is false, the screen has no 'Sign in to Dropbox' button and no Dropbox storage choice" becomes "both are shown". (If the hand-test screen is removed in the same phase, this edit is replaced by the storage settings screen's own tests.)
- **Rule:** a Dropbox refresh token is never typed. A missing token leads to the sign-in, not to the key dialog. No dialog or settings row offers a field for `dropbox.refreshToken`.
- **Hand proof** (after OI-18): sign in to Dropbox from the app, then upload, list and remove one file. Run by the stakeholder.

### Removing the hand-test tools

- Remove the hand-test screen (`src/renderer/dev/`), the `dev` commands (`dev.storage`, and `dev.comfyExtend` if CU-8 built it), the `{userData}/hand-test-local` handling, and the `dev-tools.ts` constants `HAND_TEST_LOCAL_ROOT`, `HAND_TEST_MAX_UPLOAD_BYTES`, `HAND_TEST_DROPBOX` and `HAND_TEST_FOLDER`.
- Until then the hand-test code ships in packaged builds, unreachable there.
- The `devTools` flag itself stays: it still gates `trial` ComfyUI workflows for both actors.

### The storage settings screen

- An S3 region saved empty shows "not set up".
- It replaces the hand-test screen's S3 form and Dropbox button.

## Not designed yet

- How the window tells a missing Dropbox token from a missing key, so the first leads to the sign-in. Ruled when slice G is briefed.
- The storage settings screen's layout.
