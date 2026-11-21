# Open items

This file lists every question still open for the stakeholder, the improvised choices listed for his review, and what waits on his own action. The assumption the build makes meanwhile for each question is in `spec/assumptions.md`. When an item is decided, the decision goes into `DECISIONS.md` and the topic file it changes, and the item is removed from here.

`OI-xx` numbers are kept from the old open-items table. `Q-0xx` numbers come from the old question list. `A-xx` marks a question that never had a number.

## 1. Large items

These need the stakeholder. A wrong guess would be costly to undo, would spend real money, touches his own accounts, or is a legal matter.

### OI-91. A spending ceiling for paid runs started by an agent

- **Question:** With a paid provider ticked under "Agent runs" in Settings, an agent spends money with no click from the user. The run limit (default 4 at a time, up to 8 pictures each) bounds how fast money is spent, not how much. Should there be a ceiling?
- **Meanwhile:** every agent tick is off by default, and a paid provider's tick carries the line "Paid. Each run an agent starts is charged to your account, with no click from you." No ceiling is built. Agents testing features spend only under D-085: one run per new feature, at the smallest size and shortest length the service offers, no retries, no repeat runs of a proven feature.
- **Stakeholder:** choose (a) no ceiling, as built; (b) a count of paid agent calls per app session, set in Settings, after which agents are refused for that provider (one small piece of work); or (c) a confirm dialog for every paid agent run. Decide before ticking a paid provider for agents.

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
- **Meanwhile:** ready-made LGPL builds from a public builder for Windows, and an LGPL FFmpeg built by a CI job for macOS, each pinned by address and SHA-256 checksum in `ffmpeg-sources.json`. Work starts at the beginning of Phase 7 (writing details into an MP4). Nothing is released (D-086), so no binary leaves the machine.
- **Stakeholder:** confirm the sources, or name others, before the first release. A swap is a one-line change while nothing is released.

### Before anything leaves this machine

- **Question:** Nothing is pushed, tagged or released for now (D-086). Before the first push, what may the public repository hold?
- **Meanwhile:** all work is committed and merged locally only. Nothing below blocks the build.
- **Stakeholder:** before the first push, decide or check each of these:
  - A personal-data check of the whole repository and its history (D-009). Two decision records quote the names of other projects on his computer.
  - Q-045: whether the `client/` folder goes into the repository.
  - Q-047: keep or delete the 12 Unsplash photos in the design prototype.
  - Whether `.claude/rules/security-priorities.md` goes into the repository.
  - OI-27: four build tools (`esbuild` in three versions and `electron-winstaller`) are allowed to run a script at install. A reviewer read all four and found nothing unexpected. Assumption: keep them allowed.
  - A backup of the old git history, from before the history rewrite, sits in a session scratchpad folder and still holds the private documents. He may delete it.

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
- **His paid Gemini run (D-081).** He runs the paid Gemini test case at a time of his choosing.
- **Dropbox registration (OI-18).** See Large items.
- **Naming the models that need the commercial-licence dialog (OI-76, D-088).** FLUX 3 klein is assumed; say which others.
- **Hand test of the app's ComfyUI workflows (OI-59, OI-65, OI-89).** His runs from the app decide which `trial` workflows become `proven`, and whether H3 clips follow a picture without `<Picture 1>` in the prompt. A first run from a phone photograph also shows whether turned photos need handling (A-07).
- **Review of A-53** (the asset scheme with CORS on, a security rule; `spec/assumptions.md`).
- **Review of the requirements wording (Q-011).** Needed for the requirements to return to Approved status.
- **Answers to the client reviewers (Q-050).** Whether to send the "already covered" answers back to them.
- **Old history backup.** He may delete the scratchpad copy of the old git history (see Large items).
