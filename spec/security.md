# Security

The threat model, the standing security rules a developer must not break, the risks accepted on purpose, and the named security tests. Read with the topic file of the code you touch; the detailed rules for ComfyUI, briefs and MCP live in `spec/comfyui.md`, `spec/brief-and-templates.md` and `spec/mcp-and-agents.md`. Key storage and environment variables: `spec/infra-and-settings.md`.

## Scope: what counts as an attack

Security work covers three kinds of attack: **destructive** ones, ones that give access to **sensitive data**, and ones that give **unexpected privileged access**. Nuisance attacks (a slow or frozen app, a refused file) are out of scope: noted at most, never blocking, no fixes built unprompted.

The stakeholder's words: "In general we don't care about nuisance attacks like these. The only attacks we care about (and we truly do) are destructive ones, ones that give access to sensitive data, or allow the attacker to assume any form of unexpected privileged access. That should be a general principle for future development as well".

| | What it means here |
|---|--------------------|
| **In scope: destruction** | Anything that destroys or changes the user's data without the user asking: a project file, an asset, a file on the computer or in cloud storage, a setting. Spending the user's money without leave counts the same: a paid call wasted (a lost paid picture, a paid run for a deleted variant) is in scope. |
| **In scope: sensitive data** | Anything that shows or sends a key, a token, the ComfyUI address, or a private file to a place the user did not choose. |
| **In scope: unexpected power** | Anything that gives an agent, a file, a server's answer or a web page a power the user did not grant: running a command the policy denies, writing outside the folders the app may write to, running code. |
| **Out of scope: nuisance** | A slow or frozen app, a crash that loses nothing saved, a refused file, wasted time, a wrong message, a timer that lives too long, a file left with no row, a wrong badge on a damaged file. |

- **How a finding is classed.** One question: can this destroy or change data, expose sensitive data, or give power nobody granted? If yes, it is security class and the security-class review rules apply (`spec/testing.md`). If the worst outcome is a nuisance, it is not.
- **A nuisance-only finding** gets one line in a review at most. It never fails a gate, gets no fix list and no ruling. A developer does not stop work for one.
- **When a nuisance becomes loss.** A hang or crash is in scope only when it destroys something: work not yet saved, or a paid result that had arrived. The app writes every change to the project file when it is made, so a crash alone loses nothing saved. A finding that claims loss says what is lost.
- **What is built stays.** Limits and checks built for nuisance reasons are kept where they cost nothing. None is extended for a nuisance reason. A protection is removed only by a ruling. Time limits in the ComfyUI client are nuisance numbers, not protections.
- This rule loosens no in-scope protection. The scope rule of D-053 item 23 ("one customer we care about") reads the same way.
- Spending the user did not ask for is in scope by the architect's reading; the stakeholder has not confirmed it (OI-63: confirm that unasked spending is in scope). Rules built on it stand either way.

## Threat model

| Threat | Mitigation |
|--------|------------|
| A secret committed to the public repo | No secret files in the repo, gitleaks in CI [REQ: FR-181] |
| A key leaking through a shared project | Keys live only in the app data folder [REQ: FR-173] |
| A key leaking to the agent or the window | Provider and storage keys never leave the main process. No command, query, event or tool returns one [REQ: FR-198] |
| The MCP access token leaking | Shown only to the user, in the Connect panel, through one user-only query. No tool, event, log line or file holds it. "Make a new token" replaces it [REQ: FR-191, D-014] |
| Another program or person on the network reaching the MCP server | Off by default, bound to `127.0.0.1`, bearer token [REQ: FR-191, R-04] |
| A web page in the user's browser calling the MCP server | Any `Origin` header refused; `Host` checked (stops DNS rebinding) |
| The agent spending money, exporting, publishing or destroying work | The agent policy table: deny for export and publish; ask for deletes [REQ: FR-197, FR-199]. Generation by an agent only for a provider the user ticked (`tick`) |
| Text from an agent, a brief, a file or a server carrying HTML or script | Set as text content only; strict content security policy |
| A project file from someone else naming private files | A linked file reaches a provider or a package only when its first bytes fit its kind; every path check in "Project-file values", below [REQ: R-06] |
| A corrupt or hostile project file | Every value read from it is untrusted (below). Every JSON column is parsed with Zod on read; a row that fails is reported and skipped |
| An imported file with active content | SVG is not accepted. Accepted types are fixed (below) |
| A hostile brief file | Size limit before parsing, plain YAML core rules, no parser text passed on (`spec/brief-and-templates.md`) |
| A provider's answer or picture that is very large or lies about its size | Byte limits in each adapter's `fetch`; picture bytes, type and header size checked before the decoder; every generated picture decoded and written again by the app (`spec/providers.md`) |
| The window being steered to web content | Navigation and new windows blocked; links open in the system browser, `https:` only |
| The ComfyUI address set or learned by anything but the user | One user-only command writes it; no project table, job row, asset, report, tool reply or agent-facing error holds it (`spec/comfyui.md`) |
| A mistaken or hostile ComfyUI address used to reach other things (cloud metadata, the app's own listeners, the local network) | Link-local, metadata and own-port hosts refused on the typed and the resolved address; one fixed `GET` before the server has answered like ComfyUI; no redirects; no credentials (`spec/comfyui.md`) |
| A hostile ComfyUI server, or its answers changed on plain `http` | Every answer size-limited and schema-checked; pictures through `toPng`; video through `checkMp4`, never decoded in the main process; server text cut and shown as plain text; server file names never paths here (`spec/comfyui.md`) |
| A workflow of someone else's choosing run on the user's server | Workflows are files in the app; the adapter fills a fixed list of inputs and takes no workflow, node or model name from any caller [REQ: FR-278] |
| The app or its tests disturbing other work on a shared ComfyUI server | The client has no clearing call and names only its own run IDs [REQ: FR-271, FR-289] |

## Rules: renderer and windows

Built (`src/main/windows/app-window.ts`, `app-window-options.ts`, `navigation.ts`, `open-external.ts`).

- **Window settings** (app window and the hidden render window): `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- **Who may call.** Built (`fromMainFrame` in `src/main/ipc.ts`). `registerIpc` requires a `mayCall(event)` check: a command or query is run only when it comes from the app window's own `webContents` and its main frame. Any other sender (the render window, a frame inside a page) gets the fixed reply `INVALID_INPUT` "Unknown request." before `execute` or `query` runs, and no log line is written. Events go to the app window only.
- **Navigation.** `will-navigate` is cancelled unless the target has the page's own origin (for a `file:` page, the same file). Every new window is denied; an `https:` link opens in the system browser, anything else does nothing. `openExternal` given to the core is wrapped `httpsOnly`.
- **What the window may draw.** Text from a server, a file, an agent or an AI answer (server messages, brief values, file names, display names) is set as text content, never as HTML, never as a link. No `dangerouslySetInnerHTML`.
- **Paths in the renderer.** The renderer draws no file path (a base name is drawn as text) and reads no file. It sends a path only where a command takes one, and only a path the user gave: `asset.import` (from the system picker, or from a file the user dropped on the window), `asset.relink` (relink picker), `project.package` (folder picker), `brief.parse` (brief picker). Every such command checks the path as if the user had typed it.
- **The drop bridge.** Built (`src/preload/index.ts`, `src/shared/schemas/drop-api.ts`, `src/renderer/ui/dropped-paths.ts`). The preload adds `window.drop = { pathOf(file) }` beside `window.api`, and nothing else: it returns `webUtils.getPathForFile(file)`, which is `''` for a `File` the page made. A drop never starts an import: the import dialog opens and the user presses "Import". The main process is not changed and gains no new trust (A-43). Tests: `tests/e2e/drop-bridge.spec.ts`.
- **Permissions.** Built (`src/main/windows/permissions.ts`). `denyPermissions(session.defaultSession)` is the first line of start-up (`start()` in `src/main/index.ts`); both windows use that session. Every permission request and every permission check is refused (camera, microphone, location, notifications, any other), except `clipboard-sanitized-write`, which the Connect panel's Copy button needs (`navigator.clipboard.writeText`, on click only). Test: `tests/unit/main/windows/permissions.test.ts`.
- **Page address.** One pure function, `pageAddress` in `app-window.ts`, picks it. It returns `ELECTRON_RENDERER_URL` only when `app.isPackaged` is false **and** the address matches `http://localhost:{port}` with at most one trailing slash. Nothing else may follow the port: no path, no query, no user name. In every other case it returns the built page. An installed app ignores the variable. The hidden render window follows the same rule.

## Rules: the render window

Built (`src/main/render/`, `src/preload/render.ts`). How it works: `spec/scene.md`, "The render window".

- **Same walls as the app window**: the window settings above, `offscreen: true`, never shown, the same navigation rule. Every new window is denied, with no hand-off to the system browser. Its page chosen by the `pageAddress` rule (`renderPageAddress`), and the same content security policy written into `render.html` by the build (`connect-src 'none'`, so the page can send nothing out).
- **A bridge with two functions only.** Its preload (`src/preload/render.ts`) gives `window.renderApi = { onRequest, done }` and nothing else: no `window.api`, no `ipcRenderer`. It listens on `adman:render-request` and sends on `adman:render-done`, and on no other channel.
- **The main process trusts nothing it sends back.** A `render-done` message is taken only from the render window's own `webContents` and main frame, only for the request it waits for, and only when it passes the `RenderDone` schema; overflow entries are kept only for text layers of that request. The result can change one thing: a layer's `overflow`, through `layer.reportOverflow`, which bumps no `rev` and cannot change a value a user typed.
- **What a request holds.** Variant and layer values (copy text included), asset IDs with kind, size and `missing`, and the project ID. Never a file path, a display name, a key, a token, the ComfyUI address or settings. The page builds `adman-asset://` addresses itself with `assetUrl`.
- **No calls from it.** The app's command and query channels refuse it ("Who may call", above), and it gets no event.
- **Picture bytes stay in the main process.** The captured PNG goes to the thumbnail file or to the asking query's reply, nowhere else.
- **Its life is short.** It is ended on a crash, a hang, a time-out and when the app window closes; a window that stops answering is ended and the draw fails as `crashed`. It has developer tools only with the hand-test flag.
- **Transparent.** It is created `transparent: true`, so an `overlay-only` draw has alpha 0 where nothing is drawn (`tests/e2e/scene-reference.spec.ts`).

## Rules: the asset protocol and the content security policy

Built (`src/main/windows/csp.ts`, `src/main/windows/asset-protocol.ts`, `src/main/assets/asset-url.ts`). Asset protocol details: `spec/assets.md`.

**Content security policy.** `CONTENT_SECURITY_POLICY` in `csp.ts`:

```
default-src 'self'; img-src 'self' adman-asset: data: blob:; media-src adman-asset:; font-src 'self' adman-asset:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

`electron-vite build` always writes it into `index.html` and `render.html` (`electron.vite.config.ts`). Tests: "Named security tests".

**Development server exception.** Hot reload needs an inline script and a web socket. A looser policy is allowed for the development server and nothing else.

| Bound | Rule |
|-------|------|
| When | Only the page the electron-vite development server serves (`npm run dev`, Vite command `serve`). No setting, flag or environment variable switches the looser policy on in a built page. |
| What may differ | Exactly two directives: `script-src 'self' 'unsafe-inline'` and `connect-src http://localhost:* ws://localhost:*` (`devContentSecurityPolicy('http://localhost:*')`). |
| What may not | `'unsafe-eval'`, any host other than `localhost`, any change to the other nine directives |
| Owner | Both policy texts are in `src/main/windows/csp.ts`. No other file holds a directive. |
| Everything else | Window settings, navigation blocking and the new-window rule are the same under the development server. |

Policy tests compare whole texts, never "contains": the looser policy contains the strict one's text.

**`adman-asset://` protocol.** Handled in the main process; all decisions in `asset-url.ts` with no Electron in it.

- Scheme privileges: `standard`, `secure`, `stream` and `corsEnabled` (on, A-53; fonts load only with it on). `bypassCSP`, service workers, fetch API, code cache and extensions are off. No `Access-Control-Allow-Origin` header is sent: fonts load without it. Safe because `connect-src 'none'` stays, so a page `fetch()` of an asset address is refused in both windows (`tests/e2e/asset-font.spec.ts`, `tests/e2e/render-window.spec.ts`), and the checks below do not change. Accepted risk below.
- Address `adman-asset://{projectId}/{assetId}`: the raw text is matched, not a parsed URL, so nothing is folded away (`/../`, `%2F`). Both parts are ULIDs, read in upper case; nothing may follow.
- `GET` only. A file is served only when the project is open and the asset ID exists in it, and the file is a regular file, opened before answering.
- `Content-Type` is the row's `mime`, sent only when `file-types.ts` lists it for the row's kind; never read from the file name. Text assets are never served.
- Every answer carries `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- Every failed check gets the same `404`, so the answer never says which check failed.

## Rules: files and paths

Built (`src/main/assets/`, `src/main/db/`).

**Accepted file types** (`file-types.ts`) [REQ: FR-051]. A file is accepted when its extension is listed and its first bytes match the type. SVG is never accepted.

| Kind | Types |
|------|-------|
| Image | PNG, JPEG, WebP |
| Video | MP4, MOV, WebM |
| Font | TTF, OTF, WOFF2 |
| Text | TXT, MD, JSON, YAML |

**A hostile project file is in scope for every slice.** A project file may come from anyone, so every value read from it is untrusted: names, paths, `mime`, sizes, IDs, counts. Code that puts such a value into a file path, a header, a command line or a request first checks it against the same rule the app uses when it writes that value. That code is security class.

- What always holds: the app never creates a folder outside the project file's own folder; a file is never written over an existing one; bytes handed to the window never leave it and page script cannot read them; a linked file goes to a provider or into a package only when its first bytes fit the row's kind; the checks in the table below. There is no confirm step for projects from elsewhere.

### Project-file values that reach a path, a header or a request

This table has one owner: this file. A change that makes a project-file value reach a file path, a header, a command line or a request adds or changes a row here in the same change; the developer reports the row's text and the architect writes it in. The reviewer checks each row against the code on every review of a slice that touches the named file.

| Value from the project file | Where it goes | File | Check before use | Left open |
|---|---|---|---|---|
| `name` | Opening a project; the backup of an older file | `src/main/db/meta.ts`, `project-file.ts` | The `storedProjectName` rule on every open, and before the backup | None |
| `schema_version` | Which migrations run | `src/main/db/meta.ts` | Digits only | None |
| `name` | The package folder and file names | `src/main/assets/package.ts` | `storedProjectName`, and both folders must be direct children of the target. Read once in a run. No command renames an open project, so the copied file holds the same name | None |
| Asset `id`, file extension | A managed file's path | `src/main/assets/path-resolver.ts` (`managedPath`) | ULID and `^[a-z0-9]{1,10}$`, inside `managedPath` itself | None |
| `assets_dir_rel`, `assets_dir_abs` | Where managed files are written | `src/main/assets/service.ts` (`ensureAssetsDir`), `import.ts` | A missing folder is made only inside the project file's folder, judged on real paths. A link that leads nowhere, anywhere on the way, refuses. A real folder another writer made after the first look is used; anything else found by `lstat` refuses (`RULE_VIOLATION`, `assets_folder_missing`) | An existing folder outside still receives new files (accepted, below) |
| `assets_dir_rel`, `assets_dir_abs` | The Package target check | `package.ts` | Real paths; the target may not be the assets folder or inside it | None |
| `rel_path`, `abs_path`, `kind` | Which file a package copies | `package.ts` | Extension from the base name, listed for the kind, first bytes fit; a bad `id` is treated as missing | Any real text file with a listed extension can be named by a `text` row (accepted) |
| `mime`, `kind` | The `Content-Type` of the asset protocol | `src/main/assets/asset-url.ts` | `mime` must be listed for the kind; text is never served | None |
| `rel_path`, `abs_path` | Which file the asset protocol reads | `asset-url.ts`, `service.ts` (`resolveRow`) | Regular file; read only; sent only to the app's own window with `nosniff` | No first-bytes check (accepted) |
| `rel_path`, `abs_path`, `kind` | Which file goes to a provider | `src/main/assets/service.ts` (`read`), `read-picture.ts` | Kind `image`, checked in `read`, the only caller of `readPicture`. Size limit before reading and again on the bytes read. First bytes checked before any byte leaves; the type sent comes from the bytes, not the row | None |
| `rel_path`, `abs_path` | Which file the change check reads | `src/main/assets/check-changed.ts` | Linked rows only. Read and hash only. `mime`, `width`, `height` written from the bytes, and only when the first bytes fit the row's kind; otherwise `mime` is left and the sizes set to null | Size, time and hash of any readable file are stored; for a fitting file also type, width, height (accepted) |
| `abs_path` of the named row (gives the old folder) and of sibling rows | Candidate files on relink | `src/main/assets/relink.ts` | `pathInside` the user's new folder, `realpath`, `lstat`, regular file; a sibling taken only when the file has the row's own hash; read only | None |
| Asset `id`, `abs_path` | Files looked for in a new assets folder | `src/main/assets/assets-dir.ts` (`repoint`) | `managedPath`; a bad row is left alone; `lstat`, regular files only; read only | None |
| `project_id`, variant `id`, variant `rev` | Thumbnail file names; which files the clean-up deletes | `src/main/thumbnails/paths.ts`, `cache.ts` | ULID, the variant ID pattern, a whole number; else no file is touched. Both folders real and not links by `lstat`; the project folder's real path equals the thumbnails folder's real path plus the ID. Writes never replace a name and go through `.partial`; reads take a regular file of at most 8 MiB; deletes only `{variant}-{n}.png` and `.png.partial` regular files directly in the folder | A copy of a project made outside the app may show the other copy's thumbnail (accepted, nuisance) |
| A font file's bytes (asset of kind `font`) | `asset.font_family`, shown as text | `src/main/assets/font-name.ts`, `inspect.ts` | Files over 32 MiB not parsed; WOFF2 Brotli output capped at 32 MiB; every offset, count and length bounded; never throws, any failure gives null; Cc and Cf removed, trimmed, at most 100 code points, drawn as text only | None |

### Hand-test tools

Built, removed in Phase 9 (`src/main/commands/dev/`, `src/shared/config/dev-tools.ts`). On only in an unpackaged app with `ADMAN_DEV_TOOLS=1`.

- `dev.storage` order: key guard (skipped for `local`), then the S3 settings check (`RULE_VIOLATION`, `storage_not_set_up`), then the `StorageProvider`. A provider failure is `PROVIDER_ERROR` with the detail in the log and not in the reply, and no key in either. There is no `read` action.
- `local` writes only under `{userData}/hand-test-local/adman-hand-test/` (`HAND_TEST_LOCAL_ROOT`, `HAND_TEST_FOLDER`). Before any `local` action the root and `{root}/adman-hand-test` are checked with `lstat` (`local-root.ts`): a link or a non-folder is refused with `RULE_VIOLATION`, `details = { reason: 'storage_folder_unsafe' }`, no path. Any other `lstat` error is `PROVIDER_ERROR`, `details.kind` `other`, and nothing is made.
- The adapter's "storage path refused" becomes `RULE_VIOLATION` `storage_folder_unsafe` (`storage-error.ts`). Bad names (a backslash, ending in a dot, a reserved name, a path ending in `..`) stay `INVALID_INPUT`.
- The file to upload: a `stat` or read error other than `ENOENT`/`ENOTDIR` is `RULE_VIOLATION` `file_not_readable` with a `warn` log line holding the error code; a file over `HAND_TEST_MAX_UPLOAD_BYTES` (100 MiB) is `INVALID_INPUT` before it is read.
- `HAND_TEST_DROPBOX = false`: the hand-test screen shows no Dropbox choice and no "Sign in to Dropbox" button.

## Rules: keys and secrets

Built (`src/main/secrets/`, `src/main/providers/require-keys.ts`). Storage details: `spec/infra-and-settings.md`, "Secrets".

- Secrets are encrypted at rest in `{userData}/secrets.bin` with `safeStorage`. If encryption is not available the app refuses to save keys.
- **A key file that cannot be read is never written over.** When `secrets.bin` exists but does not decrypt to a JSON object (decryption fails, bad JSON, a list, text, a number, `null`), `secret.set` and `secret.delete` refuse with `RULE_VIOLATION`, reason `secrets_unreadable`, message "Saved keys could not be read, so no key was changed. They are left as they were." The file's bytes stay as they were and no `.tmp` file is left. `get` and the summaries still show nothing saved. Test: `tests/unit/main/secrets/secret-store.test.ts`. Open: the screen offers no way out (for example removing the unreadable file); see A-20 in `spec/assumptions.md`.
- **Provider and storage keys** are held only in the main process. No command, query, event or tool returns one. The window sees only the last four characters, and nothing for a value of four characters or fewer.
- **The MCP token** leaves the main process one way only: the reply to `mcp.getConnectInfo`, to the app window, actor `user`. An agent asking gets `AGENT_DENIED` and a reply with no token. The bridge mode (Not built) reads it from `secrets.bin` itself.
- No secret of either class is ever written to a project file, a packaged project, the log, a report or an MCP reply.
- `requireProviderKeys(deps, providerId, purpose)` is the only `NEEDS_KEY` guard. Later phases call it and build none of their own.
- No key from the environment is ever written to `secrets.bin`, a log or a project file. `.env.local` rules: `spec/infra-and-settings.md`.

## Rules: settings

Built (`src/main/settings/settings-store.ts`). Detail: `spec/infra-and-settings.md`, "settings.json".

- `comfyui.baseUrl`, `agentRuns` and `agentRunLimit` are outside the `settings.update` schema. Each has one writer command (`comfy.setAddress`, `agentRuns.setAllowed`, `agentRuns.setLimit`), and every one is `deny` for agents.
- A `baseUrl` read from the file passes `parseComfyAddress` or is read as null; the refused text is kept nowhere. `merge` skips `__proto__` at every level.

## Rules: network requests

Built for MCP and ComfyUI; the Dropbox sign-in listener is Not built (Phase 9).

- The app listens in two cases only: the MCP server on `127.0.0.1:{mcp.port}`, and the Dropbox sign-in redirect on `127.0.0.1:47822` (`DROPBOX_SIGN_IN_PORT`) for the length of the sign-in. The ComfyUI adapter opens no listener.
- Outbound calls go only to the provider the user chose for the action, or one the user ticked for agents. There is no telemetry [REQ: 1.4]. Calls use TLS through provider SDKs, except ComfyUI.
- ComfyUI is reached at the address the user typed, with Node's own `http` and `https`, no SDK, and may be plain `http` to another computer with no warning [D-051 answer 6].
- **ComfyUI client rules**, one line: own `Agent` with no proxy variables, `rejectUnauthorized: true`, refused hosts on typed and resolved addresses, no redirects, no credentials, size and schema limits on every answer, no clearing call. Full rules: `spec/comfyui.md`.
- **What a ComfyUI upload sends.** Only the bytes `AssetService.read` returned for an asset ID in the job's own request, under `uploadName(bytes)` (`adman-{16 hex}.png`). The asset's display name, path, ID and subject never enter a request. The graph names the file the server's upload answer gave, after its `filename` check. The upload happens only after the server check answered `ok` for that origin. Full rules: `spec/comfyui.md`.
- **Provider answers.** Byte limits in each adapter's `fetch` wrapper; picture checks before decoding (`spec/providers.md`).

## Rules: the MCP door

Built (`src/main/mcp/`). Full rules: `spec/mcp-and-agents.md`. Every point here must keep holding:

- Binds `127.0.0.1` only.
- No token or a wrong token gets `401` and reaches no command.
- Any `Origin` header refused; a wrong `Host` refused (`request-guard.ts`; allowed: `127.0.0.1:{port}`, `localhost:{port}`).
- The token is in no log line, error, reply, test output or report.
- The actor is always `agent`.
- Turning MCP off, or making a new token, closes the listener and drops every session.
- `mcp.getConnectInfo` refuses an agent.
- No tool returns file contents, paths, settings or secrets.

## Rules: agents and cost

Built (`src/main/commands/agent-policy.ts`, agent-started runs). Full rules: `spec/mcp-and-agents.md`, `spec/agent-runs.md`.

- Every command has a row in `AGENT_POLICY` (`allow`, `ask`, `deny`, `tick`). Generation and `job.cancel` are `tick`; export and publish are `deny`; deletes are `ask` [REQ: FR-197, FR-199]. A new command adds its row; the table test checks it exactly.
- No agent reads or changes Settings, keys, storage, the ComfyUI address, a tick or the run limit.
- **Agent-started runs**: only for a provider the user ticked in Settings; off by default; only the user can tick; the tick is read on every call and again before the first send (before every send for a picture job); at most `agentRunLimit` agent runs waiting or running per provider; the result waits for the user and the agent cannot place it; every such job has `started_by = 'agent'`. A paid provider can be ticked too (Gemini today); its tick carries a "Paid" line. The limit bounds rate, not total. The app has no spending ceiling: the cap is set on the provider's own account [D-093].
- A paid call is made only when a person presses a button or the project owner runs a live test. Nothing in CI calls a real provider. No agent runs `npm run test:live`, sets `ADMAN_E2E_GEMINI=1`, makes any paid call or reads a key [D-049, D-081].

## Rules: logs, errors and messages

Built. Logging in full: `spec/testing.md`.

- The log never holds a secret value. Prompts and brief text may appear and stay on the machine [REQ: FR-153]. `brief.parse` logs reason and line number, never the line's text. Campaign commands log IDs only. A raw provider detail stays in the job's column, not in the log.
- **No code under `src/main/providers/` or `src/main/jobs/` assigns to an error's `message`.** Checked in review.
- **Parsers never leak text into errors.** Built; the reading pass over every parser is done (F-7). Code that parses text from a project file, a settings file, a brief or a server catches the parser's error and throws its own, naming the place and never the text (as `checked`, `BriefError`, `parsedJson` do). A zod error never holds a value, but its issue path and a strict object's key list can hold a key from the data, so an error built from a stored row names the column only (`checked` in `src/main/db/rows.ts`). `errorContext` still logs `message` and `stack` of unforeseen errors.
- **Brief reader rules**, one line: size limit before parsing, YAML core rules only, no anchors, aliases, tags or deep nesting, `BriefDraft` keeps known fields. Full rules: `spec/brief-and-templates.md`.

## Rules: test runs

Built (`tests/live/`, `tests/comfy/`, `tests/e2e-real/`). Full run rules: `spec/testing.md`.

- The stakeholder's product photos (`design/prototype/photos/`) are never copied, moved or committed. A test reads one only from an absolute path in a terminal variable.
- **Picture-by-path** (`ADMAN_LIVE_REFERENCE_FILES`, up to three; `ADMAN_COMFY_PICTURE`, one; `ADMAN_E2E_PICTURES`, up to three): absolute paths, terminal only, never from `.env.local`, read once into memory. Refused with one fixed line each: path not absolute, file over `MAX_PICTURE_BYTES`, bytes `pictureType` does not call PNG or JPEG, long side over 1,600 px, "could not be read", "pixel size could not be read". A fixed line has no path, file name, cause or system error text. A blank variable counts as unset.
- Only the bytes are sent. Path, folder and file name are never sent, printed, put in a result file name or a report; lines say "the given picture" or "the test-made picture". Bytes go as they are, metadata included.
- Live test output goes through `tests/live/live-output.ts`, which removes the values of `LIVE_REDACTED_NAMES` (`GEMINI_API_KEY`, `FAL_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). A skip names only the missing variables. A failed live test throws a short error with the error kind only.
- The ComfyUI address is never printed, in a test name, a locator, an `expect` on a value or a report. In real end-to-end runs every step holding it runs in a guard that rethrows one fixed sentence with no cause. `test:comfy` server text is stripped of control characters, cut to 500 characters and passed through `hideAddress`.
- Tests clear or delete nothing on the stakeholder's ComfyUI server. Only a case's own run is cancelled; `interrupt` is sent only when the run was seen working, `/api/jobs` answered, and the server version is at least `0.30.0` (`spec/comfyui.md`).

## Accepted risks and compliance

Do not "fix" these without a ruling.

**Accepted risks**

- **ComfyUI on plain `http`** [D-051 answers 4 and 6]: prompts, reference pictures and results can be read or changed on the network when the address is plain `http` to another computer, and nothing proves the server is the one the user meant. The stakeholder chose no warning. Risk table: `spec/comfyui.md`.
- **A linked path is whatever the disk holds now.** A swapped file is sent under the old picture type with `nosniff`; the window shows a broken picture and runs nothing; the window can make no network request.
- **A linked path may name any file the user's account can read.** A hostile project can list a private picture; it shows in the library, reaches a provider only if the user picks it as a reference, and Package carries it only if it really is a file of its kind. Any real text file with a listed extension can be named by a `text` row in Package.
- **The asset protocol has no first-bytes check.** Offered, not built.
- **Asset scheme with CORS on** (A-53, Built): the app's own page could read a project picture's pixels through a canvas. The page is the app's bundled code in a sandbox with no network, so nothing new can leave the machine.
- **Link swaps between check and use.** A link swapped in after an `lstat` check (in `setAssetsDir`, `hashFile` opens normally; folder import with `copy: true` uses `copyFile`, which follows links), or between the `ensureAssetsDir` check and `mkdir`. No `O_NOFOLLOW` is required: the swap needs write access to the user's folders during the command; `O_NOFOLLOW` guards only the last path part and does not exist on Windows.
- **A file opened three times on import** (head, hash, copy) can be swapped between; the change check later finds a mismatching hash.
- **An existing folder outside the project** named by `assets_dir_*` still receives new managed files `{ULID}.{ext}`, never over an existing file.
- **The change check** stores size, time and SHA-256 of any readable file a linked row names, and, when the first bytes fit the row's kind, its `mime`, width and height.
- **Error-message stack cut.** A shortened message whose later lines look like stack frames can pass the stack cut (`spec/testing.md`, logging).
- **Install scripts approved before the rule** (`esbuild`, `electron-winstaller`) stand until OI-27 is answered (`spec/infra-and-settings.md`).

**Data at rest**

- Secrets: encrypted (above).
- Project files and assets: not encrypted. They are ordinary user documents.

**Compliance.** No compliance standard is named [REQ: 6.3].

| Requirement | Control |
|-------------|---------|
| No personal data, no telemetry [REQ: 6.3] | No outbound calls except chosen providers |
| Prompts in generated files are readable by others [REQ: 6.3] | Reminder in the publish dialog (Not built, Phase 9) |
| Agent can read open projects [REQ: 6.3] | Stated beside the MCP switch in Settings: "A connected agent can read the projects you have open. That content goes to the AI service that runs the agent." |
| Licence intent: public code, no commercial reuse by others [REQ: 9.3, R-19] | `LICENSE` is PolyForm Noncommercial 1.0.0 (Not built, Phase 11). npm dependencies under MIT, ISC, BSD, Apache-2.0 or similar; the CI licence check fails on GPL or AGPL (Phase 11). FFmpeg is LGPL and shipped as a separate program. |
| Font licences [REQ: 9.3] | Fonts publish only with `font_publish_allowed` |

The stakeholder confirmed PolyForm Noncommercial 1.0.0 [REQ: R-19]. The architect is not a lawyer and this is not legal advice.

## Named security tests

These must keep passing. A change that weakens one needs a ruling.

| Test | What it proves |
|------|----------------|
| `tests/unit/main/windows/window-security.test.ts` | The strict policy equals its text character for character; the development policy equals its full expected text; window settings; `pageAddress` returns the built page when packaged with `ELECTRON_RENDERER_URL` set, and when the variable is not `http://localhost`; `http://localhost:{port}/` accepted; `http://localhost:5173/x`, `http://localhost:5173//`, `http://localhost:5173/?a=1` refused |
| `tests/build/built-page.test.ts` (`npm run test:build`, every push) | `index.html` and `render.html` each have exactly one policy tag, equal to `CONTENT_SECURITY_POLICY`; `index.html` has no word `localhost` (the only check for it) |
| `tests/e2e/csp.spec.ts` | The running window has exactly one policy tag equal to `CONTENT_SECURITY_POLICY` (imported, not copied); a frame a script adds loads no `file:` page |
| `tests/unit/main/windows/permissions.test.ts` | Both permission handlers are set; every permission is refused except `clipboard-sanitized-write` |
| `tests/unit/main/windows/asset-protocol.test.ts`, `tests/e2e/asset-protocol.spec.ts` | An imported picture loads by its `adman-asset://` address; an unknown asset ID does not; a project not open does not |
| `tests/e2e/asset-font.spec.ts`, `tests/e2e/render-window.spec.ts` | A page `fetch()` of an `adman-asset://` address is refused in the app window and in the render window; an imported font loads in the Scene |
| `tests/unit/main/windows/open-external.test.ts` | Only `https:` opens in the system browser |
| `tests/unit/config/electron-boundary.test.ts` | No `electron` import in files `core.ts` imports |
| `tests/unit/config/live-config.test.ts`, `tests/unit/config/comfy-config.test.ts` | No test or source file imports the live or comfy config; no `src/` file holds `.env.local` |
| `tests/unit/live/env-file.test.ts`, `tests/unit/config/comfy-env-file.test.ts` | Only listed names are taken from `.env.local`; the terminal wins; no switch comes from the file |
| `tests/unit/config/install-scripts.test.ts` | Every install-script entry is decided |
| `tests/integration/mcp/secret-leak.test.ts` | Calls every listed tool with the ComfyUI address and an asset path planted; neither, nor the token, appears in any reply |
| `tests/integration/queries/mcp-connect-info.test.ts` | Only `mcp.getConnectInfo`, for the user, gives the token; an agent gets `AGENT_DENIED` with no token |
| `tests/unit/main/mcp/request-guard.test.ts`, `tests/integration/mcp/server.test.ts` | `Origin` refused, `Host` checked, bad token `401`, bound to `127.0.0.1` only |
| `tests/unit/main/commands/agent-policy-table.test.ts` | The policy table exactly, and nothing else |
| `tests/integration/providers/require-keys.test.ts` | The one `NEEDS_KEY` guard, including a test-only command through the bus |
| `tests/unit/main/settings/settings-store-comfy.test.ts` | A failing address loads as null and is wiped at the next save; `__proto__` in `comfyui` or `agentRuns` adds nothing |
| `tests/unit/main/providers/comfyui/client-environment.test.ts` | Hostile proxy and TLS variables ignored; own `Agent`; every network function in the call list (`tests/helpers/comfy-every-call.ts`); `rejectUnauthorized: true`; certificate codes give `certificate` |
| `tests/unit/main/providers/comfyui/client-source.test.ts` | The client imports only its request and lookup functions and has no `clear` |
| `tests/integration/generation/run-images-comfy.test.ts` | One reference sends one upload of the asset's bytes as `adman-{16 hex}.png`; no request holds the display name or any part of the path; two references refused with `too_many_references`; a non-ComfyUI stand-in gets one `GET /system_stats` and no upload |
| `tests/integration/generation/image-kind-errors.test.ts` | A reference gone after enqueue ends `failed`, kind `other`, with no path in the row or the log |
| `tests/integration/campaigns/brief-parse.test.ts` | A malformed YAML gives a reply with the bad line and a log line with the line number and no word of the file |
| `tests/unit/main/ipc.test.ts` | A call from any sender but the app window's main frame is refused before `execute` or `query`; events go to the app window only |
| `tests/unit/main/render/done-message.test.ts`, `tests/e2e/render-window.spec.ts` | A render reply from the wrong sender, frame or request, or of the wrong shape, is ignored; the render window is never shown, has no `window.api`, and its bridge has only `onRequest` and `done` |
| `tests/unit/main/thumbnails/paths.test.ts`, `tests/unit/main/thumbnails/cache.test.ts`, `tests/integration/thumbnails/thumbnail-clean.test.ts` | Bad IDs touch no file; clean-up deletes only old thumbnails directly in the project's folder, never a link, a sub-folder or another file |
| `tests/unit/main/assets/font-name.test.ts` | A damaged or hostile font gives null and never throws |
| `tests/integration/commands/dev-storage-confinement.test.ts` | Hand-test storage changes nothing outside its folder: the app data tree, `secrets.bin`, `settings.json`, `logs/app.log` compared byte for byte |
