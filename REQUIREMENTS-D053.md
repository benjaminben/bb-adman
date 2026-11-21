# REQUIREMENTS-D053.md

**Project:** Adman
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** Draft 1. Ready to merge into `REQUIREMENTS.md`, except where a row says "open".
**Source:** D-053 in `DECISIONS-PENDING-4.md` (the stakeholder's 30 answers, word for word).
**Read against:** `REQUIREMENTS.md` 1.4, `REQUIREMENTS-Client-Input.md` (FR-230 to FR-249), `REQUIREMENTS-ComfyUI.md` Draft 4.

## What this file is

Every change D-053 makes to `REQUIREMENTS.md`, as requirement text that can be merged. `REQUIREMENTS.md` itself was not edited. It says what is needed. It does not say how to build it.

The ComfyUI and agent-tick answers (items 4, 7, 8, 9, 11, 13, 14, 15, 16, 17) are applied in `REQUIREMENTS-ComfyUI.md` Draft 4. This file points to them.

New numbers: FR-292 and FR-293 are in `REQUIREMENTS-ComfyUI.md` Draft 4. This file uses FR-294 to FR-308. The highest number in use across all requirement files is now FR-308.

---

## 1. Answered (D-053)

Answers are word for word. "Where" says where the answer is applied.

| Item | About | Answer | Where |
|------|-------|--------|-------|
| 1 | Brief size limit, 16 KB | "What would someone gain from freezing the app ?" | A question, not a decision. Nothing changed. |
| 2 | Held event-name test | "What is the test?" | A question, not a decision. Nothing changed. |
| 3 | Trust in a project file from someone else (OI-47, OI-49) | "Again what are the security concerns of any of that?" | A question, not a decision. Nothing changed. |
| 4 | Refused ComfyUI address (OI-50) | "It should just refuse a malformed URL (validation fails)" | ComfyUI Draft 4, FR-251 |
| 5 | Missing assets folder outside the project folder: ask to choose again | "Ok" | FR-296 |
| 6 | YAML message (OI-46) | "If the YAML is malformed just say so, you can share the first offending line (don't need to specify the exact reason)" | FR-297 |
| 7 | Models (OI-34) | "I believe it's the local H3 model. MOSS is not yet installed" | ComfyUI Draft 4, CQ-15 |
| 8 | Agent run limits (OI-35) | "4 is a fine default, this can be configurable. No spending cap necessary. Unticking shouldn't affect active jobs. If fal charges you either way then just let it finish." | ComfyUI Draft 4, FR-292, FR-279, FR-281 |
| 9 | Krea 2 (OI-39) | "Krea 2 can provide alternate workflows. What community add-ons are you thinking of?" | ComfyUI Draft 4, FR-288, Section 5.6 |
| 10 | Usage display (OI-40) | "That's surprising to me. I wonder if there is a better fit then as usage seems like it would be an important figure for a business like our client's. Does GPT offer this insight? I am interested in offering GPT 2.5 as a provider for image gen by the way." | FR-303 to FR-306, Section 4 |
| 11 | fal video start options (OI-41) | "Yes fal should offer the same options whatever available." | ComfyUI Draft 4, FR-286; change to FR-123 below |
| 12 | Video sound (OI-36) | "Why not keep sound? For fal as well. Although the user should be able to drop audio in as well for video variants, or use the audio that came with the video (gen or premade)." | FR-300 to FR-302; changes to FR-132, FR-051, Section 1.4 |
| 13 | `COMFY_BASE_URL` is in `.env.local` (OI-37) | "Yes" | ComfyUI Draft 4, Section 3.3 |
| 14 | Workflow files (OI-38) | "Dispatch an agent to construct workflows for me to test" | ComfyUI Draft 4, Section 9 (L-7) |
| 15 | H3 result size 768x1344 | "It will have to be acceptable, maybe we should add an optional video upscaler to the workflow as well." | ComfyUI Draft 4, FR-262, FR-293 |
| 16 | Self-signed certificates refused (OI-42) | "Ok" | ComfyUI Draft 4, FR-276 |
| 17 | ComfyUI video before fal video | "Yes" | ComfyUI Draft 4, Section 9 (L-1) |
| 18 | Chinese script tags, size range, provisional layout (OI-33) | "Ok" | Recorded. The spec stands as built. No requirement text changes. |
| 19 | Assets: remove leaves the file, changing the assets folder moves nothing, folder import limits (OI-44) | "Good. Except let's stop at 12 levels not 8" | FR-294, FR-295 |
| 20 | WebP refused as a reference picture (OI-45) | "Why refuse webp? I would prefer to support importing them, even if they require reencoding for whatever workflows" | FR-298; change to FR-051 |
| 21 | Every generated picture stored as PNG | "Correct" | FR-299 |
| 22 | Jev | "I think I may want to use Jev for another workflow I will explain later on. Let's leave it in our back pocket and consider ways it might come in handy / help optimize our workflows." | Changes to IR-002 and OI-01 below |
| 23 | S3 China regions and S3-compatible services | "I don't know they would be refused but if they add complexity to support right now we can skip them, this app, despite being available in a public repo, will have *one customer we care about aka our client*" | FR-308; Section 2.9 |
| 24 | Key rotation | "Will leave them" | Recorded. No requirement text changes. |
| 25 | Picture layers (Q-032) | "I would love the ability to extract cutouts with AI if that's an easily accessible feature via any of our providers" | FR-307. Q-032 itself is not answered (CQ-33). |
| 26 | Dropbox return address | "Will confirm Dropbox support later on" | Recorded. FR-160 stands. Open item stays with the stakeholder. |
| 27 | Git history clean-up (Q-027) | "Rewrite approved" | Recorded. Not a product requirement. |
| 28 | npm warnings | "We can address npm warnings in final cleanup" | Recorded. Not a product requirement. |
| 29 | Leftover files in an old commit | "Not concerned" | Recorded. Not a product requirement. |
| 30 | Carried questions | "Will await these questions" | Recorded. |

How the answers were read:

- Item 5 "Ok" is read as agreement with the proposal as put: the folder is not made again, the user chooses again.
- Item 12 is read as three things: generated video keeps its sound, for every video provider; the user can add an audio file to a video variant; the user can use the sound that came with a video clip, whether the clip was generated or brought in.
- Item 19 "Good" is read as agreement with all three points as built. Only the depth changes.
- Item 20 is read as: WebP is accepted everywhere a picture is accepted, including as a reference picture.
- Item 23 is read as two things: a scope decision for S3, and a rule of thumb for scope in general (Section 2.9).
- Item 24 is recorded as given. The analyst does not know which keys are meant and did not look.
- Item 25 answers only the cut-out part of Q-032. It does not say whether a variant can hold several picture layers.

---

## 2. Changes to `REQUIREMENTS.md`, ready to merge

### 2.1 Asset import and the assets folder (Sections 4.1 and 4.6)

**FR-294 (new):** When the user adds a folder (FR-050), the app imports the files in it and in its subfolders, down to 12 levels below the folder the user named. Files deeper than that are not imported. One import takes at most 500 files, counted after folders are opened up. When there are more, nothing is imported and the app says what the limit is.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Good. Except let's stop at 12 levels not 8".
- The spec has 8 levels today, marked provisional. It becomes 12. The limit of 500 files stays.
- What the app tells the user about files it left out because they were too deep is for the design. It must not be silent when it leaves files out.

**FR-295 (new):** Removing an asset from the project leaves its file on disk. This holds for a linked file and for a file in the assets folder. Changing the assets folder location (FR-007) moves, copies and deletes no file.
**Priority:** P0
**Notes:**
- The stakeholder's word: "Good" (item 19). Confirmed as built.
- Files that were in the old assets folder stay usable by the project after the location changes.

**FR-296 (new):** When a project's assets folder is outside the project's own folder and cannot be found, the app does not make the folder again. It tells the user the folder is missing and asks the user to choose the assets folder again.
**Priority:** P0
**Notes:**
- The stakeholder's word: "Ok" (item 5).
- This covers a folder the user placed somewhere else, for example on a drive that is not connected. The app must not quietly start a new, empty folder in a place the user may not expect.
- The default folder beside the project file is not covered by this answer. It follows the spec as built.
- Assets whose files were in the missing folder are shown as missing (FR-009).

**FR-051 (changed).**
Old: "Accepted file types are images, video, text content (files containing copy or briefs: txt, md, JSON, YAML) and font files."
New: "Accepted file types are images (PNG, JPEG and WebP), video, audio, text content (files containing copy or briefs: txt, md, JSON, YAML) and font files."
**Notes:** WebP is named because of FR-298. Audio is added because of FR-301. Which audio file types are accepted is open (CQ-32).

**FR-298 (new):** A WebP picture can be imported and used everywhere a PNG or JPEG picture can: shown, placed on a layer, exported, and sent to a provider as a reference picture or a first frame. Where a provider or a workflow cannot take WebP, the app turns the picture into a form it can take before sending. A picture is never refused only because it is WebP. The user's own file is not changed.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Why refuse webp? I would prefer to support importing them, even if they require reencoding for whatever workflows".
- Today a WebP asset can be imported, shown and placed, but is refused as a reference picture (spec 1.29, OI-45). That refusal goes.
- Transparency in a WebP picture is kept, as for PNG (FR-245).
- Not decided: a WebP file that holds an animation. Proposed: it is treated as a still picture, using its first frame, and the app says so on import. For the spec to confirm.
- Reading a new picture format from files the user did not make is a risk the architect has already named (OI-45). The size and type limits that apply to PNG and JPEG apply to WebP.

**FR-299 (new):** Every generated picture is stored as a PNG file, whatever form the provider returned it in.
**Priority:** P0
**Notes:** The stakeholder's word: "Correct" (item 21). Already in the notes of FR-264 for ComfyUI. This states it for every provider.

### 2.2 Briefs (Section 4.3)

**FR-297 (new):** When a YAML brief cannot be read because it is malformed, the app says that the file is malformed. The message may show the first line that could not be read. The app does not need to say exactly what is wrong with it. Nothing is created from a malformed brief.
**Priority:** P0
**Notes:**
- The stakeholder's words: "If the YAML is malformed just say so, you can share the first offending line (don't need to specify the exact reason)".
- This closes OI-46 (1) and (2). YAML features the app does not accept are reported the same way: as a malformed file.
- A line shown from the file is shown as plain text and is cut to a fixed length.

### 2.3 Video and sound (Sections 1.4, 4.6, 4.12)

**Section 1.4, out of scope (changed).**
Old: "Audio. All video is silent."
New: remove the line. Add to the timeline line below.
Old: "Timeline features: custom keyframes, easing curves, animation of image layers, audio tracks, splitting a clip in two, transitions between clips, overlapping clips."
New: "Timeline features: custom keyframes, easing curves, animation of image layers, splitting a clip in two, transitions between clips, overlapping clips. Audio editing beyond FR-301: mixing several sounds, volume curves, effects."

**FR-132 (changed).**
Old: "Video exports at up to 60 frames per second. All video is silent."
New: "Video exports at up to 60 frames per second. An exported video carries the variant's sound (FR-302)."

**FR-123 (changed).**
Old: "The app can generate a video from a variant's finished background image. Generation is for one variant at a time and is started by the user."
New: "The app can generate a video for a variant. A video can start from a first frame or from none, and can be made with or without reference pictures (FR-286). Every video provider offers the kinds of start that its service has. A kind of start a provider does not have is not offered for that provider. Generation is for one variant at a time. It is started by the user, or by an agent for a provider the user has ticked (FR-279, FR-280)."
**Notes:**
- The stakeholder's words: "Yes fal should offer the same options whatever available."
- This closes the first part of CQ-29. Workflow 5.5, FR-062, FR-064 and FR-067 change with it (Section 3).
- What fal's video service offers, read today: a video from a prompt, from a first picture (with an optional last picture), and from reference pictures (S-12). Not verified: a first frame and reference pictures in one run.

**FR-300 (new):** A generated video keeps the sound the model made with it. This holds for every video provider, ComfyUI and fal included. The app stores the clip with its sound. When a model makes no sound, the clip is silent and the app does not treat that as a fault.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Why not keep sound? For fal as well."
- This reverses FR-283 in `REQUIREMENTS-ComfyUI.md` (changed in Draft 4) and the "all video is silent" rule.
- The ComfyUI video model makes picture and sound in one file (V-20). fal's page for its video model advertises sound made with the picture (S-12). Not verified: the exact setting that turns it on.

**FR-301 (new):** A video variant can have sound. The user chooses where it comes from:
- the sound that came with a video clip on the variant's background track, whether the clip was generated or is a video file the user brought in; or
- an audio file the user adds to the variant, by dropping it in or by choosing it from the project's assets.
The user can also choose no sound. A video variant with no sound is valid.
**Priority:** P0
**Notes:**
- The stakeholder's words: "the user should be able to drop audio in as well for video variants, or use the audio that came with the video (gen or premade)".
- An audio file is an asset like any other: imported, linked or copied (FR-052), packaged (FR-008), marked missing when it cannot be found (FR-009).
- Proposed, not yet said by the stakeholder (CQ-32): one source of sound at a time, so an added audio file replaces the clips' own sound and nothing is mixed; each clip's own sound can be switched off; an added audio file starts at the start of the variant and is cut off at the variant's end; no volume control beyond on and off.
- When a variant is changed from video to image and back (FR-120), its sound settings are as they were.
- An external agent can set a variant's sound in the same ways the user can (FR-200).

**FR-302 (new):** The preview plays a video variant's sound in time with the picture. The exported MP4 carries the same sound. The sound in the export matches the preview. A variant with no sound exports as a silent video.
**Priority:** P0
**Notes:**
- This extends FR-130 ("the preview matches the export") and FR-131 to sound.
- Whether the audio file is published with the campaign's components (FR-162) is proposed as yes, since it is a component of the final export.
- The rights to use a piece of music or a recording in an ad are the user's responsibility. The app says so where audio is added. It does not check.

### 2.4 Usage and spend (new section, with FR-230)

The stakeholder's words: "usage seems like it would be an important figure for a business like our client's". Section 4 sets out the options and the facts behind them. The requirements below are the recommended option (C: both). They replace FR-287 of `REQUIREMENTS-ComfyUI.md`. They are **proposed**: the stakeholder has asked for a better fit, and has not yet chosen (CQ-30).

**FR-230 (changed).**
Old: "For each campaign the app shows the total number of paid generations used so far, split into pictures and videos. The total counts every generation sent to a paid provider for that campaign, including runs whose options were never picked. ..."
New: "For each campaign the app shows the total number of paid generations used so far, split into pictures and videos, and the estimated spend that goes with it (FR-303). The total counts every generation sent to a paid provider for that campaign, including runs whose options were never picked. A run on a local provider is never counted (FR-257). The user can see it in the campaign view and on the confirmation dialog before a run (FR-064). Each export report states the campaign's total at the time of the export (FR-150)."
Old note: "It is a count of generations, not an amount of money. The app does not know the client's prices."
New note: "It is a count and an estimate of money. The estimate uses the price list of FR-305, which the user can correct."
**Priority:** P1 to **P0** (proposed), because the stakeholder calls it "an important figure".

**FR-303 (new, proposed):** The app keeps its own record of every paid call it makes: which provider and model, what kind of job, which project, campaign and variant, when, who started it (the user or an agent), how it ended, and what the provider said was used where the provider says so in its answer. From this record the app shows, for each paid call and in total, an estimated price. The user can see the totals by campaign, by provider, by kind of job and by time span, for the whole project. Every figure of this kind is marked as the app's estimate.
**Priority:** P0 (proposed)
**Notes:**
- This is the only figure that exists for every provider and that can be split by campaign. No provider reports per campaign (Section 4).
- A call that failed, was refused, or was cancelled is recorded with how it ended. Whether it is counted as charged follows what is known for that provider; when it is not known, the app counts it and marks it as "may have been charged".
- The record covers every paid job, not only pictures and video: reading a brief, layout proposals, copy options and translation use paid text providers too.
- The record stays on the user's computer with the project. It holds no key.
- The user can save the figures as a file a spreadsheet can open, so the business can use them in its own books.

**FR-304 (new, proposed):** Where a provider can report usage and spend itself, and the user has saved a key that is allowed to read it, the app shows the provider's own figures beside the app's estimate for the same time span, and marks them as the provider's figures. Where a provider cannot report, or the saved key is not allowed to, the app says so in plain words and shows where the user can see the figures on the provider's own site. The app never shows an estimate as if it were the provider's figure.
**Priority:** P1 (proposed)
**Notes:**
- Read today: OpenAI and fal can report, each only with a key of a wider kind than the one used to generate. Google's Gemini API cannot report through a key (Section 4.1).
- A wider key is optional. The user is never made to save one in order to generate.
- A wider key is a secret and follows every key rule (FR-170 to FR-173, FR-198). It can do more than an ordinary key, and the app says what it is used for where it is entered.
- A provider's figures are for the whole account or key. They include spending made outside this app. The app says so beside them.
- A provider's figures can be late. The app shows the time the figures were read.

**FR-305 (new, proposed):** The prices the app uses for its estimates are shown to the user, with the date they were last set. The user can change any price. Where a provider publishes its prices in a form the app can read with the user's ordinary key, the app can bring them up to date when the user asks.
**Priority:** P1 (proposed)
**Notes:**
- A business may pay prices other than the public ones. An estimate the user cannot correct would not be trusted.
- Changing a price changes estimates from then on. Whether it also changes past figures is for the spec; proposed: no, a recorded call keeps the price it was estimated with.

### 2.5 OpenAI as a picture provider (Section 4.7, Section 7)

**FR-306 (new):** OpenAI's picture generation is a provider for making pictures, on the user's own OpenAI key. It sits behind the provider boundary (FR-066, IR-001) and follows every rule a paid picture provider follows: key rules (FR-170 to FR-173), the confirmation dialog (FR-064, FR-067), plain failure messages (FR-069), results stored as PNG with provider, model and prompt (FR-068, FR-299), and counting as paid (FR-230, FR-303).
**Priority:** P1 (proposed; the stakeholder's words are "I am interested in offering")
**Notes:**
- The stakeholder's words: "I am interested in offering GPT 2.5 as a provider for image gen".
- "GPT 2.5" is read as OpenAI's "GPT-Image-2.5". On OpenAI's price page today the model names are `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare`. A newer pair, `gpt-image-2.6-sunburst` and `gpt-image-2.6-flare`, is listed at the same prices (S-1, S-2). Which one is meant is CQ-31.
- Which jobs it does is not said. Proposed: a picture from a prompt, and a picture from a prompt and reference pictures. OpenAI's guide shows several reference pictures combined into one new picture (S-2). Extending a background with it is not verified.
- It is asked not to draw text, as every picture provider is (FR-061).
- Not verified: whether a started OpenAI picture request can be cancelled. Until it is, the provider has no agent tick (FR-279) and no cancel action (FR-281).
- IR-002 gains a line: OpenAI picture generation as a further picture provider. Gemini stays the default.

### 2.6 AI cut-out (Section 4.6 or 4.10)

**FR-307 (new):** The user can ask the app to cut the subject out of a picture with AI. The result is a new picture with a transparent background, stored as a new asset. The original picture is kept unchanged. The cut-out is made through a provider the app already has. When more than one such provider can do it, the user chooses, and a local provider is offered first because it costs nothing.
**Priority:** P1
**Notes:**
- The stakeholder's words: "I would love the ability to extract cutouts with AI if that's an easily accessible feature via any of our providers".
- The condition "easily accessible" is met, by what was read today (Section 5): ComfyUI has it built in, with a model under the MIT licence, and fal offers it as a paid service at under two US cents a picture.
- A cut-out made on a paid provider is a paid call: it has the confirmation dialog and is counted (FR-064, FR-303). A cut-out made on ComfyUI follows the ComfyUI rules (shipped workflow only, FR-278).
- The cut-out keeps its transparency in the editor and in exports (FR-245).
- A cut-out is most useful placed over a background. Whether a variant can hold more than one picture layer is still Q-032 and is not answered by item 25 (CQ-33). Without that, a cut-out can be made and stored, and used as a hero image or a reference, but not laid over a generated background.
- This answers S-12 of `REQUIREMENTS-Client-Input.md`.

### 2.7 Cloud storage (Section 4.15)

**FR-308 (new):** For Amazon S3, the app supports the standard Amazon regions. S3 regions in China and other storage services that copy S3's interface are not supported in this build. When the user enters one, the app says in plain words that it is not supported.
**Priority:** P0
**Notes:**
- The stakeholder's words: "if they add complexity to support right now we can skip them".
- "For now": nothing in this build should rule them out later (IR-001).
- FR-160 is otherwise unchanged. The stakeholder will confirm Dropbox later (item 26); until then "S3 and Dropbox must work in this build" stands.

### 2.8 Jev (Section 7 and OI-01)

**IR-002, Jev line (changed).**
Old: "Jev (docs: https://docs.typesafe.ai/introduction) as the optional verification provider. The analyst has not read these docs (OI-01)."
New: "Jev (docs: https://docs.typesafe.ai/introduction) is kept in reserve. It is not built in this build. The stakeholder may use it for another workflow, to be described later. The analyst has not read these docs (OI-01)."

**OI-01 (changed).**
Old: "Open. Assess Jev (typesafe.ai) for image colour verification and decide whether FR-112 is built. ... FR-112 is not built in this build."
New: "Open, waiting for the stakeholder. Jev stays in reserve. The stakeholder will describe a workflow that may use it. Until then nothing is built for it, FR-112 is not built, and the project keeps a note of places where it might help. Owner: Stakeholder. Due: when the stakeholder describes the workflow."
**Notes:** The stakeholder's words: "Let's leave it in our back pocket and consider ways it might come in handy / help optimize our workflows." Listing such ways is a task for the architect, not a requirement. The analyst proposes none here, because the Jev documents have not been read.

### 2.9 Scope rule (Section 9.2, Organizational constraints)

Add: "The app is in a public repository, but it has one customer that matters: the client. In the stakeholder's words: 'this app, despite being available in a public repo, will have *one customer we care about aka our client*'. When supporting a case that the client does not need would add complexity, the case can be left out. This is a reason to leave a thing out. It is not a reason to weaken a protection."

---

## 3. Conflicts: where D-053 disagrees with existing text

`REQUIREMENTS.md` was not edited. Each row needs a change when this file is merged.

| # | Where | What it says today | What D-053 needs | Item |
|---|-------|--------------------|------------------|------|
| X-1 | `REQUIREMENTS.md` 1.4, out of scope | "Audio. All video is silent." | Removed. Video can have sound (FR-300 to FR-302). | 12 |
| X-2 | `REQUIREMENTS.md` 1.4, out of scope, timeline features | Lists "audio tracks" as out of scope. | A video variant has sound from a clip or from an added audio file (FR-301). Mixing and volume curves stay out. | 12 |
| X-3 | FR-132 | "All video is silent." | Exported video carries the variant's sound (FR-302). | 12 |
| X-4 | `REQUIREMENTS-ComfyUI.md` FR-283 and Section 4 ("Sound. All video stays silent") | A stored ComfyUI video has no sound. | Reversed (changed in Draft 4). | 12 |
| X-5 | FR-051 | No audio files. | Audio files are accepted (FR-301). | 12 |
| X-6 | FR-121 | A clip is "a still image, a generated video or a video file the user provides". Nothing on the clip's sound. | A clip may carry sound, and the variant may use it (FR-301). | 12 |
| X-7 | FR-130, FR-131 | Preview matches export, for pictures and animation. | Also for sound (FR-302). | 12 |
| X-8 | FR-162 | Lists the components that are published. No audio. | Add the audio file used in an export (proposed). | 12 |
| X-9 | Workflow 5.5, 6.1 data entities (Variant, Asset), glossary | Written for silent video; an asset is "image, video, font, text". | Add sound to the variant and audio to the asset kinds. | 12 |
| X-10 | FR-123, workflow 5.5, FR-062, FR-064, FR-067 | Video is made "from a variant's finished background image". | Start choices for every video provider that has them (FR-123 changed, FR-286). | 11 |
| X-11 | Section 7 table, "AI image-to-video provider ... Generate video from a background image" | Image to video only. | "AI video provider ... Generate video, with or without a start picture and reference pictures". | 11 |
| X-12 | Spec, folder import limit (provisional, OI-44) | 8 levels. | 12 levels (FR-294). | 19 |
| X-13 | Spec 1.29 and OI-45 | A WebP asset is refused as a reference picture. | Never refused for being WebP (FR-298). | 20 |
| X-14 | FR-230 (`REQUIREMENTS-Client-Input.md`) | "It is a count of generations, not an amount of money. The app does not know the client's prices." P1. | A count and an estimate of money, with a price list the user can correct (FR-303, FR-305). Proposed P0. | 10 |
| X-15 | FR-287 (`REQUIREMENTS-ComfyUI.md`) | Usage is read from the provider with the user's key; "not the app's estimate". | Replaced by FR-303 to FR-305: the app's own record always, the provider's figures beside it where they can be read. | 10 |
| X-16 | FR-172 | "A key is not tested when entered." | Unchanged for ordinary keys. A wider key saved to read usage (FR-304) is first used when the user opens the usage figures; say so. | 10 |
| X-17 | IR-002 and Section 7 table | Picture providers: Gemini, Firefly stub. | Add OpenAI picture generation (FR-306). | 10 |
| X-18 | FR-150 | The report lists provider, model and prompt per generated asset. | Also the campaign's count and estimated spend (FR-230 changed). | 10 |
| X-19 | IR-002 and OI-01 | Jev "as the optional verification provider"; OI-01 "assess Jev ... and decide whether FR-112 is built". | In reserve; waiting for the stakeholder's workflow (Section 2.8). | 22 |
| X-20 | FR-160 | "Amazon S3 ... must work in this build", with no limit on which S3. | Standard Amazon regions only (FR-308). | 23 |
| X-21 | `REQUIREMENTS.md` Section 9.8 note on G-17 to G-20, and S-12 in `REQUIREMENTS-Client-Input.md` | Cut-outs not applied, not decided. | AI cut-out is wanted (FR-307). Several picture layers still undecided (CQ-33). | 25 |
| X-22 | Spec 6.11, job runner: "three per provider" | Three runs at once for each provider. | Agent-started runs are limited to 4 by default, set by the user (FR-292). The two limits must be made to agree; for the architect. | 8 |
| X-23 | Spec, ComfyUI address read from stored settings (OI-50) | Refused silently, then cleared. | Confirmed: refused. No extra message is needed (ComfyUI Draft 4, FR-251). No conflict; closes OI-50. | 4 |
| X-24 | `REQUIREMENTS-ComfyUI.md` CQ-20 recommendations | A spending limit before a paid tick; unticking cancels waiting paid runs. | No spending cap. Unticking does not touch runs already waiting or running (Draft 4). | 8 |
| X-25 | `REQUIREMENTS.md` 8.4 threat notes | Written for an app with no spending by agents. | With no spending cap, the limit on active runs (FR-292) and the record of who started each paid call (FR-303) are the only checks on an agent's spending. State this plainly. | 8 |

---

## 4. Usage and spend: facts and options (items R1 and R2)

### 4.1 What each provider can report (read 2026-11-20)

| Provider | Can the app read usage or spend? | With which key | What comes back | Not confirmed |
|----------|----------------------------------|----------------|-----------------|---------------|
| OpenAI | Yes. A "Costs" request gives money by day. Usage requests give counts; the results for pictures hold number of images, number of requests, model, size, project and key (S-3). | An "Admin API key". Every example on the reference page uses one. Only an organization owner can create one (S-4). Admin keys "cannot be used for non-administration endpoints" (S-5), so it is a second key beside the one that generates. | Costs: amount and currency, by day only, can be grouped by project, key, line item. | No OpenAI page read today says in so many words that an ordinary key is refused. A forum post reports a refusal (S-6). How late the figures are was not found. |
| fal | Yes. A usage request gives quantity, unit price and total cost by endpoint, key and date (S-7). | A key on the "BILLING" or "FULL" preset. An ordinary generating key is not named as enough. | Per endpoint: unit, quantity, unit price, discount, total cost, currency. | Whether one key can both generate and read usage ("FULL" suggests yes). How late the figures are. |
| fal, prices | A price request gives the unit price of an endpoint, and an estimate request works out a cost (S-8). | Reported as the ordinary key. | Unit price, unit, currency. | Read in a search summary only. The pages were not opened. |
| Google Gemini API | No. Google's billing page describes screens only: the usage page in AI Studio and the Cloud Billing reports (S-9). | None. "They have no independent billing settings": a key has no billing of its own; all keys in a project count together. | Nothing the app can read. | Google Cloud's billing export to a database exists as a Cloud feature. It is by project and product, not by key or request, per a forum answer (S-10). The app could not read it with a Gemini key in any case. |

Each provider's answer to a single request does carry what that request used (OpenAI: "Use the response's `usage` to measure token consumption", S-2; Gemini: usage figures in each answer, S-10). So the app can record use call by call for all three, and work out a price from the published rates. One forum post reports that for one Gemini picture model the bill was about three times what the per-answer figures implied (S-10). That is one unanswered post. It is a reason to mark Gemini figures as estimates and to let the user correct prices.

### 4.2 OpenAI picture models and prices (read 2026-11-20)

- Names on OpenAI's price page: `gpt-image-2.6-sunburst`, `gpt-image-2.6-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`, `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini` (S-1). "GPT 2.5" most likely means the 2.5 pair. OpenAI's guide describes "Sunburst for detailed visual work and Flare for fast iteration" (S-2).
- Prices are by token, not by picture. For all of 2.5, 2.6 and 2: picture output $30.00 per million tokens, picture input $8.00, text input $5.00 (S-1).
- OpenAI gives no fixed price per picture for 2.5 or 2.6. Its guide has a calculator. The guide's table for the older GPT-Image-2 gives $0.053 for a medium-quality 1024×1024 picture (S-2). The number of tokens "depends on image dimensions and quality".
- Not confirmed: a per-picture figure for 2.5 or 2.6 from OpenAI itself. Third-party pages give figures; they were not used.

### 4.3 Options for the stakeholder

**Option A. Provider figures only.** The app shows what each provider reports.
- For: these are the figures on the bill.
- Against: nothing for Gemini, the default picture provider. Needs a second, wider key for OpenAI and fal. Never per campaign. Includes spending made outside the app. Can be late.

**Option B. The app's own record only.** The app records every paid call and shows a count and an estimated price.
- For: works for every provider. Splits by campaign, variant, job and who started it. Shows at once. Needs no extra key.
- Against: the money figure is an estimate. It is wrong when prices change, when the business has its own rates, or when a provider charges for something the app did not see.

**Option C. Both (recommended).** Option B always. Option A beside it wherever the user has saved a key that allows it. Each figure is marked as "estimate" or "from the provider".
- For: the business gets a per-campaign figure for every provider, and can check it against the provider's own total where the provider gives one. A gap between the two is visible instead of hidden.
- Against: more to build. The user must understand two figures; the marking must be plain.

**Recommendation: C, built in two steps.** First the app's own record with estimated prices and a price list the user can correct (FR-303, FR-305, FR-230 changed). Then the provider's figures beside it (FR-304). A business trusts a figure it can check and correct. Option B gives the split by campaign that a business needs to bill its own clients. Option A is the check on it.

---

## 5. AI cut-out: what is available (item R3, read 2026-11-20)

| Provider | Available? | Detail | Licence, as stated |
|----------|------------|--------|--------------------|
| ComfyUI, built in | Yes | "BiRefNet is natively supported in ComfyUI". A "Remove Background" step and a ready workflow, "BiRefNet: Remove Background". Gives a picture with a transparent background, and a mask. Model file `birefnet.safetensors` in `models/background_removal/` (S-13). | "The model weights are available under the MIT License" (S-13). |
| ComfyUI, community add-on | Yes | "ComfyUI-RMBG" (author 1038lab): many cut-out models in one pack (S-14). Not needed, since the built-in step exists. | Pack: GPL-3.0. The models in it have their own licences. One of them, RMBG-2.0, is for non-commercial use unless a licence is bought from its maker, per its model page as reported in search (not opened). |
| fal | Yes, paid | `bria/rmbg-3`: "removes backgrounds and returns a transparent PNG", $0.018 a picture (S-15). `fal-ai/birefnet/v2`: the same job with the BiRefNet model (S-16). Others are listed at $0.001 to $0.018 a picture (search summary). | `bria/rmbg-3`: "trained only on licensed data, with clear commercial rights" (S-15). `fal-ai/birefnet/v2`: no licence statement on its page; its price shows as "$0 per compute seconds", which is not a usable figure. |
| OpenAI | Not as a cut-out | It can make a new picture with a transparent background ("set `background: "transparent"`", S-2). No request that cuts the subject out of an existing picture and leaves it unchanged was found. Asking the model to redraw a product on a clear background can change the product. | Not applicable. |
| Google Gemini | No | No transparent output was found in Google's documents. Forum posts and one outside test report that the picture models paint a background and return no transparency (search summary, not Google's own statement). | Not applicable. |

So: the feature is easy to reach through two providers already planned. ComfyUI is free and built in. fal is cheap and has a model whose maker states commercial rights.

---

## 6. Open questions for the stakeholder

Only questions that still need the stakeholder. CQ-30 to CQ-33 are here. CQ-34 to CQ-36 are in `REQUIREMENTS-ComfyUI.md` Draft 4, Section 6.2, and are repeated in short.

**CQ-30. Usage and spend: which option?**
Options A, B and C are in Section 4.3.
- Recommendation: C. The app's own count with an estimated price first (P0). The provider's own figures beside it second (P1), for OpenAI and fal, with an optional wider key. For Gemini, a plain note and a pointer to Google's usage page.
- Also to confirm: the user can correct the prices (yes recommended), and the figures can be saved as a spreadsheet file (yes recommended).

**CQ-31. OpenAI pictures: which model, which jobs, which build?**
- "GPT 2.5" is read as GPT-Image-2.5. It comes as "Sunburst" (detail) and "Flare" (speed). A newer 2.6 pair is listed at the same price.
- Recommendation: offer the newest pair the provider lists when it is built, with both kinds for the user to choose. Jobs: a picture from a prompt, and a picture with reference pictures. P1, built after the Gemini and ComfyUI picture paths work.

**CQ-32. Sound on a video variant: how much control?**
- Recommendation for this build: one source at a time (the clips' own sound, or one added audio file, or none); each clip's sound can be switched off; an added file starts at the start and is cut at the variant's end; no mixing and no volume control. Audio file types: MP3, WAV and M4A.
- If mixing music over a clip's own sound is needed in this build, say so. It is a larger piece of work.

**CQ-33. Picture layers (Q-032): can a variant hold more than one picture layer?**
- Item 25 answered the cut-out part only. A cut-out is of most use laid over a background, and that needs a second picture layer.
- Recommendation: yes, allow picture layers above the background, so a cut-out product can sit over a generated scene. If not in this build, the cut-out is still built, and is used as a hero image or a reference.

**CQ-34. Agent runs: the parts of CQ-20 not yet answered.** (Detail in ComfyUI Draft 4.)
- Is the limit of 4 one number for all providers together, or 4 for each provider? Recommendation: one number for all together.
- Gemini has no known way to cancel, so it gets no agent tick. Confirm. Recommendation: confirm.
- May an agent cancel runs it started? Recommendation: yes, only its own.
- May an agent pick one of the options a run made? Recommendation: no, results wait for the user.
- Should picking a run up after a short loss of contact (FR-268) be P0? Recommendation: yes.

**CQ-35. ComfyUI add-ons: which may a shipped workflow require on the server?** (List in ComfyUI Draft 4, Section 5.6.)
- Recommendation: none for the first build. Every job planned has a built-in way, as far as read, except extending a picture with Krea 2. Allow an add-on only where no built-in way works, and name it plainly.

**CQ-36. Krea 2 alternate workflows: which jobs and which build?** (Detail in ComfyUI Draft 4.)
- Recommendation: a picture from a prompt as an alternate to "Moss Image", P1, after the "Moss Image" and H3 workflows pass on the test machine. Extend a background with Krea 2 only if the "Moss Image" trial fails, since it needs a community add-on.

Still open from before and not asked again here: items 1 and 3 of D-053 (the stakeholder asked a question back), OI-51, Dropbox (item 26), and the items in `DECISIONS-PENDING.md`.

---

## 7. Assumptions

| # | Assumption | Impact if wrong |
|---|------------|-----------------|
| A-D1 | "GPT 2.5" means OpenAI's GPT-Image-2.5 picture models. | FR-306 names the wrong models (CQ-31). |
| A-D2 | "Keep sound" means keep it by default, with the user able to choose no sound. | FR-301 would need sound to be always on. |
| A-D3 | "Drop audio in" means an audio file from the user's computer, kept as a project asset. | FR-301 and FR-051 change. |
| A-D4 | The folder import limit of 12 levels is counted below the folder the user named, as the limit of 8 was. | FR-294 changes by one level. |
| A-D5 | Skipping S3 China regions and S3-like services means the app says "not supported" when one is entered. It does not mean they are let through untested. | FR-308 changes. |
| A-D6 | The client pays public prices unless the user corrects them. | Estimates are off until corrected (FR-305). |
| A-D7 | The "one customer" framing does not loosen any security rule. | Section 2.9's last sentence would need the stakeholder's review. |

---

## 8. Sources

Read on 2026-11-20. "Search summary" means the page itself was not opened.

| # | Source | Used for |
|---|--------|----------|
| S-1 | OpenAI, API pricing page: https://developers.openai.com/api/docs/pricing | Model names and token prices |
| S-2 | OpenAI, image generation guide: https://developers.openai.com/api/docs/guides/image-generation | Sunburst and Flare, reference pictures, transparent background, `usage`, GPT-Image-2 per-picture table |
| S-3 | OpenAI, API reference, organization usage and costs: https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage (first quarter of the page read) | Costs and usage fields, grouping, admin key in every example |
| S-4 | OpenAI help centre, Admin API (search summary): https://help.openai.com/en/articles/9687866 | Only organization owners create admin keys |
| S-5 | OpenAI, Admin APIs guide: https://developers.openai.com/api/docs/guides/admin-apis.md | "Admin API keys cannot be used for non-administration endpoints." |
| S-6 | OpenAI community forum (search summary): https://community.openai.com/t/v1-organization-costs-returning-404/1365618 ; cookbook: https://developers.openai.com/cookbook/examples/completions_usage_api | Ordinary key reported refused; "Set up an Admin Key" |
| S-7 | fal, platform APIs, model usage: https://fal.ai/docs/platform-apis/v1/models/usage.md | Usage fields; "BILLING" and "FULL" keys |
| S-8 | fal, platform APIs, pricing and estimate (search summary): https://fal.ai/docs/platform-apis/v1/models/pricing.md ; https://fal.ai/docs/platform-apis/v1/models/pricing/estimate.md | Unit prices readable by request |
| S-9 | Google, Gemini API billing: https://aistudio.google.com/docs/billing (reached from https://ai.google.dev/gemini-api/docs/billing) | No usage request; keys have no billing of their own; delays |
| S-10 | Google AI developers forum (search summary): https://discuss.ai.google.dev/t/per-user-cost-attribution-with-the-gemini-developer-api-s-interactions-api/195120 ; https://discuss.ai.google.dev/t/how-to-reconcile-gemini-3-pro-image-usagemetadata-with-cloud-billing-sku-reports/177653 | Billing export is by project and product; per-answer usage; one report of a mismatch |
| S-11 | (not used) | |
| S-12 | fal, Seedance 2.0 pages (search summary): https://fal.ai/models/bytedance/seedance-2.0/text-to-video ; https://fal.ai/models/bytedance/seedance-2.0/reference-to-video ; https://fal.ai/learn/tools/how-to-use-seedance-2-0 | fal video: prompt, first picture, reference pictures; sound |
| S-13 | ComfyUI docs, BiRefNet remove background: https://docs.comfy.org/tutorials/utility/remove-background-birefnet.md ; built-in step: https://docs.comfy.org/built-in-nodes/RemoveBackground.md (search summary) | Built-in cut-out, MIT licence |
| S-14 | ComfyUI-RMBG repository: https://github.com/1038lab/ComfyUI-RMBG | Community cut-out pack, GPL-3.0 |
| S-15 | fal, RMBG-3.0: https://fal.ai/models/bria/rmbg-3/llms.txt | Paid cut-out, $0.018, commercial rights statement |
| S-16 | fal, BiRefNet v2: https://fal.ai/models/fal-ai/birefnet/v2/llms.txt | Paid cut-out with BiRefNet |

---

## 9. Revision history

| Version | Date | Changes |
|---------|------|---------|
| Draft 1 | 2026-11-20 | D-053 applied. FR-294 to FR-308. Changes to FR-051, FR-123, FR-132, FR-230, IR-002, OI-01, Sections 1.4 and 9.2. Conflicts X-1 to X-25. Questions CQ-30 to CQ-36. |
