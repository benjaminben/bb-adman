# ComfyUI: the adapter

How Adman talks to a ComfyUI server the user runs: the address, the client, the check, a picture run, failures and the offline tests. Workflows, sizes, video runs, extend and what is left on the server are in `spec/comfyui-workflows.md`; the real-server trials and tests are in `spec/comfyui-trials.md`. Readers usually also need `spec/providers.md` (registry, error kinds), `spec/cancel.md` (cancel) and `spec/security.md`.

**Direction:** outbound. **Protocol:** HTTP or HTTPS to one address the user typed, through Node's built-in `node:http` and `node:https`. **Authentication:** none. **Requirements:** [REQ: FR-250–FR-278, FR-282–FR-286, FR-288–FR-291, D-050, D-051, D-052] (`REQUIREMENTS-ComfyUI.md`).

**End state in one sentence.** The ComfyUI address has one owner, `settings.comfyui.baseUrl` in `settings.json`, written by one command; every other piece of code reads it from there at call time, and no project file, job row, asset, log of a project, package or report ever holds it.

**When the app contacts the server** [REQ: FR-275]: a check the user asks for; a run the user starts; a run an agent starts while the provider's tick is on (`spec/agent-runs.md`). Nothing else: not app start, not project open, not a timer.

**V** marks a fact verified by reading ComfyUI's public source or the analyst's verified list; **U** one a real-server trial decides ("Facts relied on", at the end).

## The registry row

Built. `src/main/providers/registry.ts`, after `fal-seedance`, before `firefly`: `id 'comfyui'`, `label 'ComfyUI'`, `jobs: ['image', 'video']`, `available: true`, `secrets: []`, `defaultModels: {}`, `local: true`, `cancel: 'stops'`, `serverText: true`. In `DEFAULT_PROVIDERS` it is the video provider (the only one with an adapter), not the picture one. A ComfyUI call adds nothing to `paid_calls` and asks for no paid confirmation. ComfyUI gets four jobs at once like every provider (`JOBS_AT_ONCE_PER_PROVIDER`, `spec/jobs.md`); the app shows each job's place in the server's queue.

## The address (security class)

Built. `src/shared/comfy/address.ts`, `src/shared/comfy/refused-hosts.ts`, `src/main/commands/comfy/`, `src/main/settings/`.

Every other adapter talks to a host fixed in the code (`spec/providers.md`). This one talks to a host the user typed. The exception is accepted [REQ: A-C6, D-050] under the rules below, all security class.

### Who may set it [REQ: FR-250, FR-253, FR-272, FR-273]

- One command writes it: `comfy.setAddress { address: string | null }` (`spec/api-commands.md`). App scope, agent policy deny, returns `{ baseUrl }`; `null` removes it. Saving contacts nothing [REQ: FR-275].
- `settings.update` cannot write it: its patch schema refuses the keys `comfyui` and `agentRuns`, the same way `mcp.enabled` is kept out.
- Nothing else writes or supplies it: no project file, package, brief, imported file, job row, other command input, environment variable or answer from the server. The app reads no `COMFY_*` variable; `COMFY_BASE_URL` is for `test:comfy` only (`spec/comfyui-trials.md`, "Trials on a real server"). Opening a project or package made elsewhere leaves the address unchanged and sends nothing [FR-273].
- No MCP tool, event to an agent or error sent to an agent holds it. The window reads it with the user-only query `comfy.getInfo` (`spec/api-queries-events.md`), so the user sees it in full [REQ: FR-253].
- It may appear in the app's own log in the app data folder [D-047]. It never goes into a project's tables, `job.request`, `job.result`, `job.error_detail`, an asset's embedded details, a report or anything published.
- An address that fails `parseComfyAddress` is refused wherever it comes from. Typed in the app: the command's validation message, and the old address is kept. Found in `settings.json`: read as none, and written as `null` at the next save, with no message. A `comfyui` value that is not an object makes the whole settings file fall back to defaults, as any bad file does.

### Which forms are accepted [REQ: FR-251, FR-276]

One pure function, `parseComfyAddress(text, ownPorts)`, is the only reader of what the user typed. It gives `{ origin }` or a reason. Only the origin is stored: scheme, host and port, lower case, no path, no trailing slash.

| Step | Rule | Reason when refused |
|------|------|---------------------|
| 1 | Trim. Empty, or longer than 255 characters | `address_empty`, `address_unreadable` |
| 2 | If the text does not start with `http://` or `https://` (any letter case): text that holds `://` is refused; otherwise `http://` is put in front. So `10.0.0.5:8188` and `my-pc:8188` are accepted. | `address_scheme` |
| 3 | Read with `new URL`. A failure, or an empty host | `address_unreadable` |
| 4 | A user name or password in the address (an empty user part, `http://@host:8188`, is accepted and stored clean) | `address_credentials` |
| 5 | A path other than `/`, a query or a fragment. A server behind a sub-path is not a plain server. | `address_extra` |
| 6 | Port 0 | `address_unreadable` |
| 7 | The host is on the refused list below | `address_host_refused` |

Accepted as pasted: `http://127.0.0.1:8188` (what a server prints, **V**), `http://localhost:8188/`, `http://[::1]:8188`, `http://10.0.0.5:8188`, `http://studio-pc.local:8188`, `https://comfy.example.lan`. Plain `http` to another computer is accepted with no warning [D-051 answer 6].

### Refused hosts

Checked twice: on the typed host in step 7, and on every address the name resolves to, at every connection ("The client" below). The typed host is checked after `new URL` has turned number forms such as `2130706433` and `0x7f.1` into dotted form, and after an IPv4 address inside an IPv6 one (`::ffff:a.b.c.d`) is unwrapped. Only `::ffff:a.b.c.d` is unwrapped; `::a.b.c.d` and `64:ff9b::/96` are not.

| Refused | Why |
|---------|-----|
| `169.254.0.0/16` and `fe80::/10` (link-local), and `fd00:ec2::254` | Cloud metadata services live here (`169.254.169.254`). No ComfyUI server is reached this way. |
| `0.0.0.0` (alone, not `0.0.0.0/8`), `::`, `224.0.0.0/4`, `ff00::/8`, `255.255.255.255` | Not the address of one machine |
| The names `metadata`, `metadata.google.internal`, `instance-data`, and any name ending in `.internal` that starts with `metadata.` | Metadata by name |
| A loopback host (`127.0.0.0/8`, `::1`, `localhost`, a name ending `.localhost`) with one of the app's own ports: the current `settings.mcp.port` and the Dropbox sign-in port 47822 | The app must not call its own listeners |

Private ranges (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`) and loopback on any other port are allowed. That is the feature.

- The two own ports are handed in as `ownPorts` (`src/main/providers/comfyui/own-ports.ts`). The Dropbox port's one owner is `DROPBOX_SIGN_IN_PORT` in `src/main/providers/dropbox/sign-in-port.ts`; no other file writes 47822.
- `mcp.port` can change after the address is saved, so the connection-time check uses the ports as they are at that moment.
- The list's one owner is `src/shared/comfy/refused-hosts.ts`.

### What a typed address can receive, at most

This bounds a mistaken or hostile address.

1. **Before the server has shown it is ComfyUI:** exactly one request, `GET /system_stats`. No body, no cookie, no credential, fixed headers. Nothing else is sent until the answer has the ComfyUI shape ("The check" below). A router, printer, metadata service or other program at that address gets that one request and nothing of the user's.
2. **After:** only the fixed calls of the client, to that origin. The prompt and pictures go only then.
3. **Shown back to the user from a server that is not ComfyUI:** nothing. An answer without the expected shape gives a fixed sentence. Its body is never shown, stored or logged.

### Not followed, not trusted [REQ: FR-274, FR-277]

- A redirect (any 3xx) is never followed. The `Location` value is never read. The call fails with reason `redirect_refused` and the user is told.
- No address, path or file name in a server's answer is ever used as an address to call or as a path on the user's computer.
- HTTPS uses the normal certificate checks (`rejectUnauthorized: true`, set by the client, so no environment variable switches it off). A certificate that cannot be checked gives reason `certificate`, with the plain message. There is no "trust this certificate" choice.

### Risks left, accepted by the stakeholder

Recorded here and in `spec/security.md`.

| Risk | Accepted by |
|------|-------------|
| On plain `http` to another computer, anyone on the network path can read the prompts, reference pictures and results, change them, and answer in the server's place. The app shows no warning. | D-051 answer 6: "Allow plain http to another computer" |
| A plain server has no sign-in, so the app cannot know it is talking to the server the user meant | D-051 answer 4: "Plain only for now" |
| Whoever runs the server sees prompts, brief text in prompts and reference pictures; uploads stay on it; each video run leaves a file on it | D-050, D-052 answer 26; said to the user where the address is entered [REQ: 3.3 Privacy] |
| A user talked into typing an address sends their prompt and pictures to that machine once it answers like ComfyUI. The confirmation dialog shows the address before each run the user starts [REQ: FR-256]. | Follows from D-050 (A-C1) |
| A name may later resolve to a different machine on the local network. The app checks the refused ranges at each connection, not that the machine is the same one. | Architect's note; follows from D-050 |

## The client: one origin, a fixed list of calls (security class)

Built. `src/main/providers/comfyui/client.ts`, `request.ts`, `lookup.ts`, `answers.ts`, `refusal.ts`, `upload-form.ts`, `values.ts`, `limits.ts`.

`createComfyClient({ origin, ownPorts })` is the only code that talks to a ComfyUI server. It has **one function per call below and no general "request" function.** No function takes an address or a path. The folder's `index.ts` exports only the adapters; `client.ts`'s export list is pinned by a test to `['createComfyClient']` (it re-exports types only).

| Function | Call | Notes |
|----------|------|-------|
| `systemStats()` | `GET /system_stats` | The handshake. **V** |
| `modelFiles(folder)` | `GET /models/{folder}` | `folder` comes from a shipped workflow only. 404 gives null: every file of that folder counts as missing. **V** |
| `nodeInfo(classType)` | `GET /object_info/{classType}` | One class at a time, never the whole list. 404 gives false. **V** |
| `uploadImage(name, bytes)` | `POST /upload/image`, form fields `image`, `type=input`, `subfolder=adman`; `overwrite` is never sent | Refuses any name but the app's own for those bytes. **V** |
| `submit(promptId, graph)` | `POST /prompt`, body `{ prompt, prompt_id, client_id }` | Requires `number` in the answer. One `client_id` per client; not a secret. **V** |
| `history(promptId)` | `GET /history/{promptId}` | 404 gives null. **V** |
| `jobState(promptId)` | `GET /api/jobs/{promptId}` | 404 gives null, and the adapter falls back to `queueIds` and `history`. **V** that the route exists; **U** from which version |
| `queueIds()` | `GET /queue` | Only IDs and positions are kept; the rest of the answer, which can hold other people's work, is dropped at once. |
| `adopt(promptId)` | none | Adds an ID to the own-ID set; called only by the adapter's cancel (below). |
| `removeFromQueue(promptId)` | `POST /queue`, body exactly `{ "delete": [promptId] }` | Own IDs only. **V** |
| `interrupt(promptId)` | `POST /interrupt`, body exactly `{ "prompt_id": promptId }` | Own IDs only. **V**: with an ID, the server stops only that run, and skips when it is not the running one |
| `viewFile(ref, maxBytes)` | `GET /view?filename=&subfolder=&type=` | **V** |

**Calls the client cannot make** [REQ: FR-271, FR-289]. No function for: `POST /queue` with `clear`; `POST /history` (clear or delete); `POST /interrupt` with no ID; `POST /free`; anything under `/userdata` or `/users`; any `DELETE`. A source-text test (`tests/unit/main/providers/comfyui/client-source.test.ts`) reads every file under `src/` and fails on `clear`, `/free`, `/userdata`, `/users` or `DELETE` in the client's files (`refusal.ts` included). The bare word `clear` stays on its list.

**Nothing outside the client can name a path.** `send` and `openConnection` (`request.ts`) are imported only by `client.ts` and exported from neither `client.ts` nor `index.ts`. `lookup` is imported only by `request.ts`. The same source-text test holds this.

### How every request is built

- From the parsed origin, as an options object for `http.request` or `https.request`: `protocol`, `hostname`, `port`, `path`, `method`, `headers`. The path is a constant plus values passed through `encodeURIComponent`. No request line is built by joining text the user or the server supplied.
- **The resolved address is checked.** Each request passes a `lookup` function (`checkedLookup`) that resolves the host, drops addresses of the other family, refuses when any resolved address is on the refused list (with the own ports as they are now), and hands the socket only the address it checked. A refusal is a `ProviderFailure`, kind `other`, reason `address_refused`. Nothing has been sent.
- **Headers** are fixed: `Accept`, `Content-Type`, `Content-Length`, `User-Agent: Adman`. Never `Origin` (**V**: a server on loopback answers 403 when `Origin` and `Host` differ), `Referer`, `Cookie` or `Authorization`. No cookie is kept between calls.
- **Nothing from the environment.** Every request uses the client's own `Agent` instance, not `http.globalAgent` or `https.globalAgent`, made with no `proxyEnv` option, and no proxy. With `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` and `NODE_TLS_REJECT_UNAUTHORIZED=0` set to hostile values, the request still reaches the pinned origin, with certificate checks on (`client-environment.test.ts`).
- **Certificates.** Every `https` call passes `rejectUnauthorized: true` and the client's own `Agent`, itself made with `rejectUnauthorized: true`, so `NODE_TLS_REJECT_UNAUTHORIZED=0` has no effect. Node's certificate error codes (ten accepted, including `DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_HAS_EXPIRED`, `ERR_TLS_CERT_ALTNAME_INVALID`) give reason `certificate`, with nothing written to the request.
- `node:http` does not follow redirects. A 3xx status is the `redirect_refused` failure.
- Not Electron's `net` (system proxy, Chromium's cookies) and not global `fetch` (no hook to check the resolved address). No new package.

**Two proofs on a real process.** Built, in `npm test`, `tests/integration/providers/comfyui/`. `client-certificate.test.ts`: with `NODE_TLS_REJECT_UNAUTHORIZED=0`, all 11 client calls refuse a self-signed HTTPS server (certificate made by `openssl` in a temporary folder, no key in the repository) with reason `certificate`; it skips with one printed line where `openssl` is missing. `client-proxy.test.ts`: in a child process with `NODE_USE_ENV_PROXY=1` and the proxy variables set, all 11 calls reach the pinned server and the proxy stand-in sees no connection (A-39).

### Values that go into a path or body are checked first

| Value | Rule |
|-------|------|
| `promptId` | Made by the app with `crypto.randomUUID()`, sent as `prompt_id` (**V**: the server accepts a caller's ID; **U**: that a UUID passes its check). The ID in the server's answer must match the UUID pattern or the run fails. Both the ID sent and the ID answered join the own-ID set. |
| `filename` from a history entry | 1 to 128 characters of `A-Z a-z 0-9 . _ - ( )` and space; no `/`, `\` or `..` |
| `subfolder` | 0 to 128 characters of the same set plus `/`; no `..`, no leading `/` |
| `type` | `temp` or `output` only |
| Upload `name` | Made by the app: `uploadName(bytes)` = `adman-{first 16 hex of the SHA-256 of the bytes}.png` (`values.ts`). The name in the server's answer is used in the workflow, after the `filename` check. **V**: without `overwrite`, the same bytes under the same name are not written twice, and a different file with that name gets a counter, so nobody's file is overwritten. |

### The own-ID set, and who may remove or interrupt (security class) [REQ: FR-271, FR-289]

The adapter keeps one set, for the life of the app process, of the IDs `submit` gave it (`own-ids.ts`). Only the adapter's cancel (pictures and video) calls `adopt`, then `removeFromQueue` or `interrupt`, and only for an ID in that set; for any other ID it sends nothing and answers `unknown` (tested: no `POST` reaches the stand-in). An ID that only a job row or project file supplied may be looked up but never removed or interrupted. Cancel itself: `spec/cancel.md`.

### Limits on every answer [REQ: FR-277]

Security class. Owners: `src/main/providers/comfyui/limits.ts` and `src/main/providers/picture-limits.ts`.

| Constant | Value | Owner |
|----------|-------|-------|
| `MAX_COMFY_JSON_BYTES` | 8 MiB, any JSON answer | `limits.ts` |
| `MAX_PICTURE_BYTES` and the other picture limits | As `spec/providers.md` | `picture-limits.ts` |
| `MAX_VIDEO_BYTES` | 128 MiB | `picture-limits.ts` (shared with fal video) |
| `MAX_VIDEO_SIDE`, `MAX_VIDEO_MS` | 4,096 pixels; 120,000 ms | `picture-limits.ts` |
| `MAX_SERVER_TEXT_CHARS` | 2,000 (a message: an exception's type or text) | `limits.ts` |
| `MAX_SERVER_NAME_CHARS` | 256 (a name, version or status; longer than 128 so a cut name can never pass the file-name check by being cut) | `limits.ts` |

- Byte limits refuse on a `content-length` over the limit, else count while reading and stop. Every JSON answer goes through a Zod schema that keeps known fields only; every text from the server is cut to a stated length before it is kept.

**Time limits** (`limits.ts`; provisional, set again after the trial [REQ: 3.3 Performance]). They are nuisance numbers, not protections.

| Constant | Value |
|----------|-------|
| `CONNECT_MS` | 10 s: the connect wait and the first-byte wait, the fixed wait of FR-265 |
| `SHORT_CALL_MS` | 15 s in all |
| `UPLOAD_MS` | 120 s |
| `DOWNLOAD_MS` | 300 s |
| `POLL_MS` | 2 s |
| `LOST_CONTACT_MS` | 5 min of polls failing in a row [REQ: FR-268] |
| `QUEUE_WAIT_MS` | 12 h waiting in the server's queue |
| `PICTURE_WORK_MS` | 30 min working on a picture |
| `VIDEO_WORK_MS` | 120 min working on a video |
| `MIN_TARGETED_INTERRUPT` | `'0.30.0'`: `/interrupt` is sent with an ID only from this server version |

- **The 10 s wait has two parts** (`request.ts`): connect, from the call's start to `connect`/`secureConnect`; first byte, from the request's `finish` event (body sent) to the answer's first byte, so a slow upload body does not end `no_answer`. Both give reason `no_answer`. No timer is cancelled: each checks a flag when it fires (accepted nuisance). Test in `client-time.test.ts`.
- **Not built: resetting the time limits after the trial.** If a measured video work time exceeds `VIDEO_WORK_MS`, set it to twice the measured time, rounded up to ten minutes. The waiting and working limits stay marked provisional until then.

### A refused graph: a 400 on `/prompt`

`Call.refusedStatus` in `request.ts` lets one named status back to the client; only `submit` sets it, to 400. `submit` then throws `ComfyRefused` (a subclass of `ProviderFailure`, exported from `refusal.ts`). Its `error` is exactly `{ kind: 'other', reason: 'server_refused', detail: 'HTTP 400' }`, with none of the server's words. It also carries `refusal`:

```ts
type ServerRefusal = {
  type?: string
  message?: string
  details?: string
  nodes: { nodeId: string; errors: NodeRefusal[] }[]
}
type NodeRefusal = { type?: string; message?: string; details?: string; inputName?: string }
```

- The top three fields come from the answer's `error`; `nodes` from `node_errors`, one entry per key, `inputName` from `extra_info.input_name`. Field names are from reading ComfyUI's source; the first real refused graph corrects them.
- The schema drops the traceback, `received_value`, `input_config`, `dependent_outputs` and the server's `class_type`. Each text is cut to `MAX_SERVER_TEXT_CHARS`; `nodeId`, `type` and `inputName` to `MAX_SERVER_NAME_CHARS`.
- A 400 whose body is not JSON, too large or of another shape is still `server_refused`, with `nodes: []` and no text.
- `ProviderError` does not change. The runner and log see a plain `ProviderFailure`. Only `failures.ts` (through `cleanServerText` into `error_detail`) and the `test:comfy` printer read `refusal`. The adapter never parses a 400 itself.

### Reasons the client picks

| What happened | Kind, reason |
|---------------|--------------|
| Too large, not JSON or the wrong shape, from `systemStats` | `other`, `not_comfyui` |
| The same from any other call | `other`, `bad_result` |
| A status outside 2xx from `systemStats` that is not a redirect or sign-in | `other`, `not_comfyui` |
| 401, 403, 407 | `other`, `sign_in_needed` |
| 3xx | `other`, `redirect_refused` |
| 400 from `/prompt` | `other`, `server_refused` |
| Any other status | `other`, no reason, detail `HTTP n` |
| A failed or dropped connection, or any time limit | `offline`, `no_answer` (during a run, failed polls become `lost_contact`) |

## The check, and "what is missing"

Built. `createServerChecks` in `src/main/providers/comfyui/needs.ts`; `comfy.check` in `src/main/commands/comfy/`.

`comfy.check` (`spec/api-commands.md`; user only) is the user's "check the address" [REQ: FR-252]. Every run starts with the same check. **The check is the one holder of the rule "exactly one request before the server has shown it is ComfyUI"** (security class, sensitive data): no client function other than `systemStats` is called for an origin until the check has answered `ok` for it.

1. `systemStats()`. The answer must be JSON with `system.comfyui_version` as text and `devices` as a list (**V**). Outcomes: `ok`; `no_answer` (could not connect, or no answer in 10 s); `not_comfyui` (answered, wrong shape, or 404); `sign_in_needed` (401, 403, 407); `redirect_refused`; `certificate`; `address_refused`.
2. For each workflow on `NON_DRAFT_WORKFLOWS` (`workflows/index.ts`; drafts are never compared), compare its `needs` with the server [REQ: FR-263, FR-266]:
   - version: `comfyui_version` against `needs.minComfyVersion`, as dotted numbers. A version that cannot be read, or one newer than the version the workflow was checked against, is a note, not a failure [REQ: 3.3 Compatibility].
   - model files: one `modelFiles(folder)` per folder; a file is there when an entry equals its name or ends with `/` plus its name.
   - node classes: `nodeInfo(classType)` per class in `needs.nodeClasses`; missing when the answer is 404 or has no entry for the class (**U** which a server gives; both count as missing).
3. The answer lists, per workflow, each missing item. **The names come from the app's own workflow file, never from the server's text**, so the list can be shown, logged and given to an agent safely. The reply has no entry for a draft.

Rules:

- The check sends no prompt or picture and starts nothing [REQ: FR-252]. A failed model or node call ends the whole check with that failure's reason, else `not_comfyui`. It fails closed.
- **Kept result.** Kept in memory per origin for 60 s (`CHECK_MS` 60,000). A run reads only a kept `ok` under 60 s old; any other kept outcome is asked again. A kept `ok` with missing items stays for its 60 s. `comfy.check` asks again on every press and replaces the kept result. `comfy.check` and every run hand the check the same list, `NON_DRAFT_WORKFLOWS`, because the memory is per origin.
- A run whose workflow has a missing item does not start: kind `other`, reason `missing_items`, with the items [REQ: FR-266]. The server's own check at submit time is the second net (**U-1**): a 400 is `server_refused`.
- Tests (`needs.test.ts`, adapter tests): against a stand-in that is not ComfyUI, `comfy.check` sends exactly one request, `GET /system_stats`, and a picture run sends exactly that one request, no upload and no `/prompt`; a check ending `no_answer` is followed at once by one that asks again; a kept `ok` is not asked again inside 60 s; with one `draft` and one `trial` spec, no request names the draft's node classes or folders.
- **Not built:** whether single check items are marked "could not check" instead of failing the whole check is ruled with the rest of `test:comfy`, from what a real server shows.

How Settings shows the result: `spec/screens.md`.

## A picture run

Built. `src/main/providers/comfyui/image.ts`, `session.ts`, `run.ts`, `poll.ts`, `fill.ts`, `failures.ts`.

`comfyui/index.ts` exports `image`, `video` and `cutout`. The job kind calls `ImageProvider.generate(input, opts)` with `count: 1`, as for every provider. Video runs: `spec/comfyui-workflows.md`, "A video run".

1. Read the address from `ctx.settings()`. None saved: reason `address_needed`. The command normally catches this first.
2. Pick the workflow with `workflowForRun`: no references gives the `image` workflow, otherwise `image_refs`. Too many references is refused by the command before any call, with the number the workflow takes; none is dropped silently [REQ: FR-260].
3. The check. Not `ok`, or a missing item, stops the run here and nothing more is sent.
4. Upload each reference with `uploadImage` ("Uploads" below).
5. `fitSize` (skipped when the workflow has no `width` slot), `fillWorkflow`, `submit`.
6. Poll every `POLL_MS`. `history(id)` first: an entry means the run ended. Otherwise `jobState(id)` (or `queueIds()`) says waiting, with a place in the queue, or working. `opts.onProgress` gets `{ stage: 'waiting' | 'working', queuePosition?, fraction? }` (`fraction` from "Live progress"), and the runner writes it into the job so the two look different [REQ: FR-269]. Found in neither place on two polls in a row: reason `server_stopped`.
7. On success, read the result at the workflow's own `outputNode` key in the history entry's `outputs`: the first item that has `filename`, `subfolder` and `type`, under any list name (**U-2**). A node key or list name from the server is kept uncut in memory only, and never stored, logged, shown or sent on. `viewFile` fetches the file; `pictureType` checks the bytes. The adapter returns `{ bytes, mime, model: spec.model.mainFile, details }`.
8. The job kind passes it through `toPng` and stores a PNG the app's own encoder wrote, as for every provider. Nothing the server wrote into the file is kept [REQ: FR-264].

- **Generation details** (`spec/export-and-checks.md`). `ImageResult.details?: { models: string[]; workflow: { id: string; version: number } }`, filled in `run.ts` from the shipped workflow file (every model file it names, its `id`, its `version`), never from the server. `pngOf` (`src/main/jobs/kinds/image-generation.ts`) adds `models` and `workflow` only when `details` is present.
- **No file in the server's output folder for pictures** [REQ: FR-282]. `PreviewImage` writes to the server's temporary folder (V-16), cleared when the server starts (V-39; D-051 answer 11). The websocket-only save node (V-15) is not used: a break would lose a finished picture.
- **A short break** [REQ: FR-268]: a failed poll (no answer, or a 5xx answer; pictures and video) is not a failure. Polls go on until one succeeds or `LOST_CONTACT_MS` (5 minutes) passes, then reason `lost_contact`, whose message says the server may still be working. `viewFile` is retried on a connection break only, because the file is still on the server.
- An `execution_interrupted` message in the history gives reason `server_stopped` (`run.ts`).
- **Kept options** [REQ: FR-267]: pictures that arrived are kept when a later option fails. Each option is its own submission with its own seed [REQ: FR-257].
- **The address during a run.** The run keeps its starting origin in memory, and its client is wrapped (`pinnedClient` in `session.ts`) so that before each call the saved address is compared with it. If they differ, or the address was removed, nothing more is sent, not even a cancel, and the run fails with reason `address_changed`.
- **After the app was closed.** A ComfyUI job found `queued` or `running` at project open is not picked up; the app does not contact the address on project open [REQ: FR-275]. It is set to `failed`, reason `lost_contact` (`src/main/jobs/start-up.ts`). This covers a project from another computer with a job row from someone else's server. No ComfyUI row is resumed after a restart (`spec/jobs.md`). Picking a run up again by a user action is a later pass (FR-268 is P1).
- **Retry.** `job.retry` on a ComfyUI picture job calls `checkComfyRun` with the reference count from `old.request`; on a video job, the check `generation.startVideo` calls. The chosen workflow is not stored on the job row.
- **Cancel** (`spec/cancel.md`): the run ends cancelled only when the server confirms the stop.

### Uploads (security class; user's files)

- The bytes are what `AssetService.read` returned for an ID in the job's own request: always a clean PNG (A-55), so they match the `.png` name and no metadata goes. Nothing else is read from disk.
- The name is `uploadName(bytes)`. The asset's display name, path, ID and subject never enter a request.
- The name put in the graph is the one in the server's upload answer, after the `filename` check.
- The upload happens only after the check answered `ok` for the origin.
- References and first frames are the only files the app puts on the server. They are never removed.- Tests (`tests/integration/generation/run-images-comfy.test.ts`, adapter tests): one upload of the asset's bytes under `adman-{16 hex}.png`; no request holds the display name or any part of the path; the graph names the file the stand-in answered with; two references on a one-slot workflow are refused (`too_many_references`, no job row); a non-ComfyUI stand-in sees one `GET /system_stats` and no upload; `paid_calls` stays 0 and the address is nowhere in the project file.

### Live progress

Built (security class). `src/main/providers/comfyui/live.ts`, `live-messages.ts`, `progress.ts`. "How far along" comes only over ComfyUI's live connection (V-4) [REQ: FR-269], one connection per picture or video run, to the run's own origin (`liveTarget` in `request.ts`), never to an address from a message. It listens only; any failure ends it in silence and the run carries on by polling.

- `ws` 8.23.0, pinned, a direct dependency (A-54), not Electron's built-in `WebSocket`, which (Electron 45) has no message size limit, follows an environment proxy, and accepts any certificate when `NODE_TLS_REJECT_UNAUTHORIZED=0`. `@types/ws` is not installed: the project's own `ws.d.ts` types only the names `live.ts` uses.
- Settings, fixed in `live.ts`: `maxPayload: 65536`; `perMessageDeflate: false`; `followRedirects: false`; `handshakeTimeout` `CONNECT_MS`; no `origin`; only a `User-Agent: Adman` header; the client's own `agent` and `checkedLookup`, and `rejectUnauthorized: true` for `wss:`. A binary message is dropped unread.
- `readLive` reads a text message as JSON through a schema, only for the run's own prompt ID, and only `progress` (`value` ≤ `max`, `max` 1 to 1,000,000), `execution_start`, `executing`, `execution_success`, `execution_error`, `execution_interrupted`. It gives `working` with a whole percent, or "ended" (closes the connection). No piece of a message is kept or logged. The connection also closes when the run ends or is cancelled.
- `progressReporter` calls `onProgress` only when the stage, queue position or whole percent changed, and a working run does not go back to waiting on a late poll.
- The host is checked against the refused list when the target is made, and by `checkedLookup` at connect; the gap is accepted.
- **Address change** (`sendWhenStill` in `live.ts`). A connection is opened, and its handshake sent once the socket is connected, only if the saved address is still the run's origin at that moment. An open connection is closed, reading nothing more, at its next message after the change, and when the run ends on the change. Test: `tests/integration/providers/comfyui/live-address-change.test.ts`.
- Tests: `tests/integration/providers/comfyui/live-connection.test.ts` (no redirect followed; no `Origin`, `Cookie` or `Authorization` in the handshake; a text or binary message over 64 KiB closes it; own agent and checked lookup; self-signed `wss:` refused with `NODE_TLS_REJECT_UNAUTHORIZED=0`), `live-proxy.test.ts` (`NODE_USE_ENV_PROXY=1` in a real process: the proxy sees nothing), `live-adapters.test.ts`; `tests/unit/main/providers/comfyui/live-messages.test.ts`, `progress.test.ts`, `live-run.test.ts` (polling finishes a run with nothing heard), `live-source.test.ts` (no global `WebSocket` or `fetch` in `comfyui/`; the three files log nothing).

## Failures, and the server's own words

Built in the main process (`failures.ts`, `src/shared/providers/messages.ts`); the window half is partly built (see below). [REQ: FR-265, FR-266, FR-267, FR-069]

`ProviderError` has an optional `reason` (`spec/providers.md`). The six kinds and `job.error_kind` are unchanged. The window picks the sentence by `reason` when set (`reasonMessage(reason)`, with `{address}` and `{n}` left as marks the window fills), else by kind.

| Case | Kind | Reason | Plain message |
|------|------|--------|---------------|
| No address saved | `other` | `address_needed` | "Enter your ComfyUI server's address to use it." |
| Could not connect, or no answer in 10 s | `offline` | `no_answer` | "Nothing answered at {address}. Check that ComfyUI is running and the address is right." |
| Answered, not ComfyUI | `other` | `not_comfyui` | "Something answered at {address}, but it is not a ComfyUI server." |
| 401, 403, 407 | `other` | `sign_in_needed` | "The server at {address} asked for a sign-in. Adman can only use ComfyUI servers without one." |
| 3xx | `other` | `redirect_refused` | "The server tried to send Adman to another address. Adman did not follow, and the run was stopped." |
| Certificate | `other` | `certificate` | "Adman could not check the server's security certificate." |
| Refused range or own port | `other` | `address_refused` | "Adman cannot use that address." |
| Missing model, node or version | `other` | `missing_items` | "The server is missing {n} thing(s) this workflow needs. Add them to the server yourself, then try again." followed by the list |
| The server's check refused the workflow (HTTP 400) | `other` | `server_refused` | "The ComfyUI server did not accept this request." |
| Out of memory: the error's type holds `OutOfMemory`, or its text holds "out of memory" or "allocation on device", any letter case | `other` | `out_of_memory` | "The ComfyUI server ran out of memory. Try a smaller size or a shorter clip, or free memory on the server." |
| Any other error during the run | `other` | `run_failed` | "The ComfyUI server could not finish this run." |
| The run is in neither the queue nor the history | `other` | `server_stopped` | "The ComfyUI server stopped or lost this run." |
| Polls failed for 5 minutes | `offline` | `lost_contact` | "Adman lost contact with the ComfyUI server. The server may still be working on this run." |
| Over the waiting or working limit | `timeout` | `too_long` | "This run took longer than Adman waits. The server may still be working on it." |
| The address changed during the run | `other` | `address_changed` | "The ComfyUI address was changed while this run was going. The run was stopped." |
| A result over a limit, of the wrong type, or failing `checkMp4` | `other` | `bad_result` | "The ComfyUI server sent a result Adman cannot use." |
| A clip with sound | `other` | `clip_has_sound` | Listed, never raised: sound is kept (`spec/comfyui-workflows.md`, "A video run") |

- `{address}` is filled in by the window from `comfy.getInfo`. No error object, job row or project log line holds the address.
- The retry rule of `spec/providers.md` holds: nothing is sent twice on the app's own decision. Polling a run already started is the stated exception.
- Command refusals before any job row (`spec/api-commands.md`): `comfy_address_needed`, `comfy_job_not_offered` ("ComfyUI cannot make this kind of picture yet."), `too_many_references` with `details.max` ("ComfyUI takes one reference picture for this run." when `max` is 1, else "ComfyUI takes at most {max} reference pictures for this run."). Both sentences live in `src/shared/providers/messages.ts`.
- **Built:** Settings' `comfy-check-result.tsx` takes its six check sentences from `messages.ts` (`checkMessage`), and `redirect_refused` has a Settings form: "The server tried to send Adman to another address. Adman did not follow."
- **Built (window, S2-5):** a failed row shows the reason's sentence, `missing_items` lists the items (from the failed row's `result.missing`), each message has Retry, and the first seven reasons also offer "Open Settings" [REQ: FR-265] (`spec/screens-campaign.md`).

### The server's own message, on request [REQ: FR-267, FR-277; D-051 answer 9]

An exception to FR-069 and to "`error_detail` is never shown" (`spec/data-model.md`), for a provider whose `ProviderInfo.serverText` is true: ComfyUI only.

- Kept: from a 400, `error.message`, `error.details`, and each node error's `message` and `details`; from a failed run, the exception's type and message. Never the traceback: it holds paths on the server's computer.
- One function, `cleanServerText(text)` in `comfyui/server-text.ts`: control characters other than a line break become spaces, escape sequences are removed, and the whole is cut to `MAX_SERVER_TEXT_CHARS` with "…". The result is stored in `job.error_detail`.
- The window gets it with the user-only query `job.getServerMessage` (built), only when the user presses "Show the server's message", and draws it as text under "Message from the ComfyUI server", never as a link, path, command or instruction (`<a href>` shows as characters).
- **Never to an agent.** No MCP tool returns it. An agent gets the kind, reason, plain message and missing-item list, all the app's own words.
- **The server's text is data**, as are its model names, file names and version text: cut, shown as text, never acted on (no link followed, no command run, nothing installed).

## Offline tests

Built, except where marked. The harness rules shared with other real-service runs are in `spec/testing.md`; the variables in `spec/infra-and-settings.md`.

**The normal run** (`npm test`, CI) never contacts a ComfyUI server. It uses the stand-in `tests/helpers/comfy-stand-in.ts`, an HTTP server on `127.0.0.1` that plays the client's routes and can wait, fail, redirect, send too much or vanish. `tests/helpers/comfy-every-call.ts` lists every network function of the client. Offline end-to-end: `tests/e2e/comfy-stand-in.spec.ts`.

**The ComfyUI run on a real server** (`npm run test:comfy`), its rules, cases and who may run it: `spec/comfyui-trials.md`, "Trials on a real server".


## Facts relied on

**Verified** (ComfyUI `server.py`, docs.comfy.org "Routes" and "Messages"): the client's routes exist; `POST /prompt` reads `prompt`, `prompt_id`, `client_id`, `extra_data`, answers `{ prompt_id, number, node_errors }`, and 400 with `{ error, node_errors }` on a failed check; `POST /interrupt` with a `prompt_id` stops only that run when it is running, and with no ID stops whatever runs; `POST /queue` and `POST /history` take `clear` and `delete`; `/upload/image` takes `image`, `type`, `subfolder`, `overwrite`, answers `{ name, subfolder, type }`, does not rewrite identical bytes, adds a counter on a name clash; `/view` refuses `..`; the 403 on loopback when `Origin` and `Host` differ; the live messages `status`, `execution_start`, `execution_cached`, `executing`, `progress`, `executed`, `execution_success`, `execution_error`, `execution_interrupted`. Analyst's list: V-3, V-8, V-15 to V-25, V-38, V-39.

**Not verified:** from which version `/interrupt` takes an ID and `/api/jobs` exists (below `MIN_TARGETED_INTERRUPT`, or with an unreadable version, a running job is not interrupted and the cancel outcome is `unknown`); that a UUID passes the server's ID check; the shape of a history entry and a job state (U-2); what `/object_info/{class}` answers for a missing class; the frame rule; that the server runs each slot-dropped graph; the analyst's U list.
