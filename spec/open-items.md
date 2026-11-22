# Open items

This file lists every question still open for the stakeholder, the improvised choices listed for his review, and what waits on his own action. The assumption the build makes meanwhile for each question is in `spec/assumptions.md`. When an item is decided, the decision goes into `DECISIONS.md` and the topic file it changes, and the item is removed from here.

`OI-xx` numbers are kept from the old open-items table. `Q-0xx` numbers come from the old question list. `A-xx` marks a question that never had a number.

## 1. Large items

These need the stakeholder. A wrong guess would be costly to undo, would spend real money, touches his own accounts, or is a legal matter.

### OI-18. Dropbox app registration (done, D-090, D-091)

- **Done:** the app is registered as an app-folder app. The app key is the one on record [D-007]. A short-lived access token for a live test is in `.env.local`.
- **Done in the Dropbox console [D-091]:** the redirect address `http://127.0.0.1:47822/oauth/dropbox` is listed, and the scopes `files.content.write`, `files.content.read` and `files.metadata.read` are switched on.
- **Meanwhile:** Dropbox is built against stand-ins, then one live upload, list and remove is run with the access token. The browser sign-in is proven only by hand.
- **Effect of app-folder access:** publishing lands inside `Apps/<app name>/` in the user's Dropbox. A shared team folder outside it cannot be chosen as the target.

### OI-76. Models whose licence forbids commercial use (decided, D-088)

- **Decided:** a workflow that runs such a model shows a dialog when a run starts: "<model> requires a commercial license, please confirm that you have one before production use", with "Cancel", "Confirm" and a checkbox "don't show again for <model>".
- **Assumptions around it:** the tick is saved per model in settings and can be cleared there. Each workflow's data says whether its model needs the dialog; FLUX 3 klein is the first. A run started by an agent cannot press Confirm, so it is refused with a plain reason until the user has ticked "don't show again" for that model.
- **Stakeholder:** say which other models need the dialog. Reading each licence stays the user's own duty.

### OI-09. Where the shipped FFmpeg comes from

- **Question:** The app ships an FFmpeg program for macOS and Windows. It must be an LGPL build, not GPL, so the app's own licence is not affected. Which source supplies it?
- **Meanwhile:** for Windows, a ready-made LGPL build from the public builder repository `FFmpeg-Builds/FFmpeg-Builds`; for macOS, an LGPL FFmpeg built on this machine by the fetch script from the FFmpeg release source archive. Each is pinned by address and SHA-256 checksum in `scripts/ffmpeg-sources.json` (P7-3; details in `spec/phases/phase-07.md`, "Where FFmpeg comes from"). The macOS source archive's pin was checked against its PGP signature from the FFmpeg release signing key on 2026-11-21. The Windows pin must be checked by hand against the release's own checksum file before the first Windows run. Nothing is released (D-086), so no binary leaves the machine.
- **Answered:** the stakeholder agreed to this plan ("Good with ffmpeg source plan"). A swap stays a one-line change while nothing is released.

### Approvals by link (D-095)

Designed in `spec/approvals.md` and `spec/approvals-service.md`; none of these blocks the first slices.

- **OI-94. Hosting plan for the approvals service.** Answered [D-097]: Next.js on Vercel with a Turso database (`spec/approvals-service.md`). The stakeholder accepted Turso, starting on its free tier ("Fine with your recommendations on database for now"). The password check keeps 100,000 rounds of hashing; it is not weakened without asking.
- **OI-95. Should visitors see each other's email addresses?** Answered [D-096]: yes (A-99).
- **OI-96. Pictures in the user's S3 bucket, or in the service's own storage?** Answered [D-096]: the user's bucket (A-89).
- **OI-97. The S3 part of Settings' "Cloud storage".** Answered [D-096]: built now, and required. The user enters their own bucket credentials in Settings; the app is never given an environment file (A-95).

### Before the repository is made public

- **Where things stand:** `main` may be pushed to the private GitHub repository of D-008, and releases made there as drafts (D-102). The repository becomes public only on the stakeholder's word.
- **The personal-data check** (D-009) was run on 2026-11-22 over every version of every file reachable from `main` (9,855 file versions, 2,257 commits) and every commit message:
  - *Not found anywhere:* a key or token of any service, a private key, a real server address, the stakeholder's name, email address or computer name in any file, a real person's home-folder path, a real email address. Every address, path and email in tests is made up.
  - *Found, for the stakeholder to rule on before going public:*
    1. The author field of every commit holds the stakeholder's name and email address (accepted under D-018; a GitHub private-address setting or a history rewrite would hide the email).
    2. D-008 in `DECISIONS.md` names the remote, which holds the GitHub username.
    3. D-034 in `DECISIONS.md` names another project's folder on the stakeholder's computer, and with it the company the work was made for.
    4. One commit message (an approvals-service commit) holds a path inside the stakeholder's home folder, which shows the account's short name and this folder's name. Only a history rewrite removes it.
    5. The requirement, decision and spec files quote the stakeholder's own words throughout. That is by design (D-019, D-091), listed so it is a choice.
  - Items 2, 3 and 5 can be changed in a new commit, but stay in history. Removing anything from history needs a rewrite, which no agent does without the stakeholder's word.
- **Not in the repository, and not pushed** (untracked): `client/` (Q-045), `design/` with its 12 stock photos (Q-047) and the reference ads, `.claude/`, `comfy-workflows/`, the two loose documents in the root, `examples/hydrating-shampoo/` and `examples/silk-hour-ads/`. Each stays out unless the stakeholder says otherwise.
- **Only `main` is pushed.** The other local branches (several hundred, one per finished slice) stay local.
- **Still open:**
  - OI-27: four build tools (`esbuild` in three versions and `electron-winstaller`) are allowed to run a script at install. A reviewer read all four and found nothing unexpected. Assumption: keep them allowed.
  - A backup of the old git history, from before the history rewrite, sits in a session scratchpad folder and still holds the private documents. The stakeholder may delete it.
  - No licence is chosen (D-102). Until one is, the README says all rights are reserved.
  - The push workflow runs the whole test suite on macOS and Windows at every push. On a private repository this uses the account's included build minutes quickly (macOS minutes count ten times). Nothing is charged unless a spending limit is set.

## 2. Assumptions made to keep the build moving

In `spec/assumptions.md`.

## 3. Improvised choices already built

The video card and the agent settings block were built with these choices. Each is easy to change.

**The "Make a video" card**

1. A card under "Make pictures", not a new screen.
2. Title "Make a video", button "Start".
3. Length in whole seconds, default 2, least 1, most the workflow's limit.
4. Progress as elapsed minutes, no percentage.
5. No autoplay; controls shown; sound as the clip has it.
6. The clip shown at the panel's width in the run result.
7. Label "Length (seconds)"; a prompt box of 3 rows.
8. The prompt starts empty.
9. A length above the most is sent as the most, with the note "The clip will be shorter: at most {n} s".
10. 0 or a decimal is refused before sending.
11. The most applies only for ComfyUI, and only once the app knows it.
12. "No video provider is available." when there is none.
13. The run row shows provider, "Video", then status; "Waiting" with no number when the server gives no place in its queue.
14. "Working, m min" counts from when the run was made, queue time included, refreshed every 15 s.
15. A finished clip marks the run as seen.
16. The clip's accessible name is "Video result"; a bad result shows "No clip.".

**Video from a picture**

17. One "Start from" choice on the same card: "A prompt", "A first-frame picture", "A reference picture".
18. Default "A prompt".
19. The picture is chosen from the project's reference pictures, one at a time, with the card's own "Add pictures".
20. A hint under a picture start: "Tip: call the picture <Picture 1> in the prompt."
21. The run row is unchanged ("Video").
22. No preview of the crop.
23. "A prompt" is offered for ComfyUI always, even before the server info answers.
24. "Add pictures" chooses the first added picture that can be sent.
25. The chosen picture is kept when switching between the two picture starts, kept but not sent under "A prompt", and dropped when it leaves the list or cannot be sent.
26. Heading and region name "Picture to start from"; empty line "No reference pictures in this project yet."

**Agent runs in Settings**

27. An "Agent runs" block below the MCP section: one checkbox per provider, "Let agents start runs with {label}"; under a paid provider, "Paid. Each run an agent starts is charged to your account, with no click from you."; a number field "Most runs agents may have waiting or running, per provider", 1 to 16; the block shows whether or not the MCP server is on; the run row says "Started by an agent".

## 4. Open, not needed for this build

- **OI-01. Jev for image colour checks (FR-112, P2).** Kept in reserve until the stakeholder describes the workflow he has in mind. A disabled slot exists; nothing is built.
- **OI-06. Agents starting export or publish.** Both stay refused for agents in this build.
- **OI-14. Signed installers.** This build ships unsigned installers with README steps (D-015). Signing comes later and needs his Apple developer account.
- **OI-58. Krea 2 workflows.** Not answered: which jobs Krea 2 gets. The analyst suggests a picture from a prompt, as an alternate to MOSS-Image. No phase needs it.
- **A-12. Qwen image edit as a fourth ComfyUI model.** Raised from a reference workflow file; no answer. Nothing in this build needs it.

## 5. Waiting on the stakeholder's own action

- **Windows test (D-087).** He tests on Windows once the first draft is complete. Until then, anything the spec says must pass "on both systems" is recorded as checked on macOS only.
  - **Bridge mode on Windows.** The bridge points Chromium's `sessionData` at a fresh temporary folder (`spec/mcp-and-agents.md`, "Bridge mode"). On Windows, `safeStorage`'s key lives in Chromium's `Local State` file, which moves with `sessionData`, so the bridge may not be able to decrypt the stored token there. To check by hand: Claude Desktop connects through the bridge on Windows. If it fails, the likely fix is to copy `Local State` into the temporary folder (`spec/phases/review-leftovers.md`).
- **fal usage page (OI-04, A-173).** The one paid fal run is done and is never repeated. He reads his fal usage page for that run's price and for whether status calls were charged.
- **His paid Gemini run (D-081).** He runs the paid Gemini test case at a time of his choosing.
- **Dropbox registration (OI-18).** See Large items.
- **Naming the models that need the commercial-licence dialog (OI-76, D-088).** FLUX 3 klein is assumed; say which others.
- **Hand test of the app's ComfyUI workflows (OI-59, OI-65, OI-89).** His runs from the app decide which `trial` workflows become `proven`, and whether H3 clips follow a picture without `<Picture 1>` in the prompt. A first run from a phone photograph also shows whether turned photos need handling (A-07).
- **Review of A-53** (the asset scheme with CORS on, a security rule; `spec/assumptions.md`).
- **The extend trial on his ComfyUI server (U-13).** `moss-extend` is a `draft` stand-in, so Phase 5's "Generate fill" runs on Gemini and the fake provider only. A real extend graph, arriving as data and marked `trial`, makes ComfyUI fill available with dev tools on; until then P5-19's one real ComfyUI extend run is owed. If the trial fails, CQ-27 (Krea 2 as the fallback).
- **Cut-out on his ComfyUI server (A-57).** Before P4-9's one real run: a ComfyUI release that has the background-removal nodes, and `birefnet.safetensors` in `models/background_removal/`. Until then the run reports the missing items and cut-outs work through the fake provider only. Later, his own check decides whether `birefnet-cutout` becomes `proven`.
- **Review of the requirements wording (Q-011).** Needed for the requirements to return to Approved status.
- **Answers to the client reviewers (Q-050).** Whether to send the "already covered" answers back to them.
- **Old history backup.** He may delete the scratchpad copy of the old git history (see Large items).
- **Approvals service: deploying (D-095, D-097).** He sets the service up on Vercel with the steps in `approvals-service/README.md` (from AP-13; listed in `spec/approvals-service.md`): the project, the Turso database, the service key and the address. Then one "Update gallery" to his real S3 bucket and one sign-off through the deployed service, by hand.

## 6. Questions for the stakeholder

- **Fill on a video variant.** In the fan-out dialog, with only "Video" ticked and "Generate fill" chosen for a size, the command names a fill on a video variant. Is that wanted?
- **The example brief warns on export.** `examples/brief.yaml` requires the words "Summer Splash", but its message does not hold them. So every export of the example warns and needs "Export anyway". Should the example export cleanly?
- **Titles of ads made from a brief.** They are titled by subject IDs (for example `citrus-can+berry-bottle`), and that title also becomes the export folder name. Is that wanted, or should they get a readable title?
