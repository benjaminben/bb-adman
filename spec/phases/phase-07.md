# Phase 7 — Video and timeline

Bullets carry `[logic]` (main process, shared code, commands, queries, data, providers, the Scene, render) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** Video variants preview as they will export.
**Class:** C, D, E

Already built in Phase 2 and not repeated here: `generation.startVideo` with ComfyUI (prompt, first-frame and reference starts), the video job kind, `checkMp4`, the video limits, and the "Make a video" card.

## Scope

- [logic] The FFmpeg fetch script (`spec/infra-and-settings.md`), built first in this phase, because the MP4 embed needs it. Packaging stays in Phase 8.
- [logic] Animation presets as pure functions; Scene support for time, timing and presets.
- [logic] Background track: clip commands (add, move, reorder, trim), black gaps, Scene preview with `<video>`.
- [logic] fal.ai Seedance adapter (slice J, below), job resume, generation details embedded in MP4. The background render, resume, the embed and the clip are built here (`spec/providers-adapters.md`).
- [logic] Video format in fan-out.
- [logic] `variant.setFormat`, image to video and video to image, with the allowed-changes table, the grid test in both directions and the round-trip guarantee (`spec/data-rules.md`). Settle OI-20 first.
- [UI] Timeline: one track per layer, timing bars, entrance and exit blocks, playhead, play, pause, scrub.
- [UI] Format and duration controls on a variant.

## Exit criteria

- Workflow 5.5 passes with the fake provider, starting from an image variant that is changed to video.
- The named format round-trip test and the named refused-format-change test pass.
- Preset reference pictures pass (macOS by agents; Windows by the stakeholder, D-087).
- A running video job survives closing and reopening the app.

## Dependencies

- Phase 6.
- The Seedance route checked (`spec/providers-adapters.md`).
- The FFmpeg build source chosen (OI-09), because the MP4 embed needs it.

## Carried in from earlier work

### Slice J — the fal.ai Seedance adapter

- **Class:** E. **Security class** (cost). Built in this phase whatever OI-30 says; OI-30 decides only whether the fal client package is used.
- **Done when:**
  - `src/main/providers/fal-seedance/` (today an empty `adapters` object) has `VideoProvider.start` and `check`, the fal upload of the still, the download of the MP4, the error mapping, and recorded-response tests.
  - `tests/live/seedance.live.test.ts` turns one still into one MP4 in a temporary folder. OI-04 is answered here. Under D-085 one low-cost paid run at the shortest length confirms it once.
  - Registry: default model `bytedance/seedance-2.0/image-to-video`, secret `fal.apiKey`. `fal-seedance` goes back to `available: true`, and the `app-state.test.ts` row becomes `['fal-seedance', true]`.
  - `@fal-ai/client` is added only if OI-30 is yes: exact version, licence checked against the licence list (`spec/infra-and-settings.md`), any install script given a `false` entry.
  - Video limits shared with ComfyUI: `MAX_VIDEO_BYTES` 128 MiB, `MAX_VIDEO_SIDE` 4,096, `MAX_VIDEO_MS` 120,000 (`picture-limits.ts`).
- **Start kinds.** Offer only what fal's model is proven to have (prompt, first picture, reference pictures, as read by the analyst, not verified; with OI-04). A kind fal lacks is refused by `generation.startVideo` before any call, as ComfyUI's refusal is for a pair with no workflow. A new `VideoProvider` member to state the kinds goes to the architect first.
- **Provider-neutral refusal.** Today a picture start with any provider other than ComfyUI is refused with "ComfyUI cannot make this kind of video yet." (`video-start-checks.ts` calls `videoNotOffered()` for every provider). Write a provider-neutral sentence with its own refusal.
- **Retry checks for every provider.** `job.retry` skips the picture checks for a video row whose provider is not ComfyUI, so a crafted row's stored asset IDs would be handed to that provider. `checkVideoRetry` must run checks 2 and 4 of the `generation.startVideo` checks (the start pair and the picture) for every provider, with one test.
- **Sound.** The clip is stored as returned, after `checkMp4`. Check whether fal needs a setting to make sound (see sound below).
- **Cancel and charges.** `cancel_would_still_charge` applies to fal (`spec/cancel.md`): a request fal has started (`result.stage` is `working`) is not asked to stop; `job.cancel` is refused `RULE_VIOLATION`, reason `cancel_would_still_charge`, "{Provider} has started this and will charge for it. The app lets it finish and keeps the result." Check U-25: does fal charge for a cancelled started request. What closing a project does with such a job is ruled when J is designed (OI-60, OI-51).
- **Left-over rows.** Check whether fal charges for a status call or a fetch. If it does, or that cannot be shown, fal rows are not resumed and end as interrupted. Say whether a resumed status call counts in `paid_calls`.
- **Agent tick.** Once J sets `available: true`, `agentRunsOffered` gives null for fal, so the user can tick it, and Settings shows the paid note under it. Update the MCP start-tool descriptions, which today name only `comfyui` and `gemini`. The cases that expect `fal-seedance` to be refused change with this slice (`tests/integration/commands/agent-runs-settings.test.ts`, "gives agent_runs_not_offered for fal-seedance, S3 and Firefly", and the `fal-seedance` rows in `tests/integration/commands/agent-run-gate.test.ts`).
- Nothing is written into a project by the adapter alone; the clip path is this phase's `generation.startVideo` work.

### Video facts and the clip file

- A ComfyUI clip's asset row has `width` and `height` null, because `inspectFile` reads picture sizes only. The FFmpeg step fills them. Until then the job result holds the sizes.
- Video assets fill `duration_ms` (null today).
- Video file details (`models`, `workflow`) are written into the clip file by FFmpeg (OI-36). The `details: 'pending'` default stands until then. Writing details keeps the sound stream: the `-an` wording no longer applies to generated clips.
- The asset protocol serves byte ranges for video. Any range support keeps every confinement rule of the protocol: GET only, exact address, open project, kind `image`, `video` or `font`, a known `mime`, 404 with an empty body, `nosniff`, `no-store`, no path in answers. **Security class.**
- MP4 and MOV detection may be tightened beyond `ftyp` alone (today HEIC, AVIF and M4A files named `.mp4` pass as video).
- A temporary place for video files while a job runs [REQ: FR-291].
- Picking a run up after the app was closed [REQ: FR-268, P1], with job resume.

### The format switch

- `generation.startVideo` gains a refusal for a variant whose format is `image`. Today a clip can be started on a picture variant.
- The first frame becomes the rendered background layer, instead of the chosen picture asset.

### Sound on a video variant, and audio assets (OI-54)

- [REQ: FR-301, FR-302, FR-051 as changed]. This phase: the data, the audio asset kind and the preview. Phase 8 puts sound in the export. Waits for CQ-32.
- One source at a time: the clips' own sound, one added audio file, or none. Each clip's sound can be switched off. An added file starts at the start and is cut at the variant's end. No mixing, no volume.
- Audio files: MP3, WAV, M4A, AAC.
- It changes the data-model rules, the export rules and ADR-006, which describe silent video. Today a clip with sound is refused (`clip_has_sound`).

### Slice US — usage and estimated cost (OI-52)

- After slice J, before Phase 8. [REQ: FR-303, FR-305, FR-230 as changed]
- Usage is the app's own count of paid calls (`paid_calls` is the start) with an estimated price. The user can correct the price list. A changed price does not change past figures. Figures can be saved as a spreadsheet file.
- Figures read from a provider (FR-304, FR-287) are not planned.

### Slice OA — OpenAI pictures (OI-53)

- After slice J. [REQ: FR-306]
- Models `gpt-image-2.6-sunburst` and `gpt-image-2.6-flare` (names as read; checked when built), both offered, for a picture from a prompt and a picture with reference photos. Behind `ImageProvider`. Gemini stays the default.
- No agent tick and no cancel action until a way to cancel is verified.

## Not designed yet

- Slice J's start kinds and the new `VideoProvider` member, closing a project with a fal job that will still charge (OI-60, OI-51), and resume of fal rows.
- Sound and audio assets: waits for CQ-32.
- Slice US: needs its own design pass.
- Slice OA: needs its own design pass.
- The temporary place for video files (FR-291).
- **Cut-out through fal** (FR-307, OI-55, A-57), after slice J. A second `CutoutProvider` behind the Phase 4 command and job (`spec/ai-jobs.md`, "Cut-out"): `fal-seedance`'s key, one paid call per cut-out, listed after ComfyUI in the run dialog. Its model, host, price and cancel behaviour are designed with it.
