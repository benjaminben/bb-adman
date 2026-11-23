# REQUIREMENTS-ComfyUI.md

**Project:** Adman
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** Draft 4. The stakeholder's answers in D-053 (`DECISIONS-PENDING-4.md`) are applied. CQ-15, CQ-20, CQ-27, CQ-28 and CQ-29 are closed or replaced. Three questions are open (CQ-34 to CQ-36, Section 6.2). CQ-30 to CQ-33 are in `REQUIREMENTS-D053.md`. Nothing here is in `REQUIREMENTS.md` yet.
**Read against:** `REQUIREMENTS.md` 1.4 (Sections 1.4, 4.7, 4.12, 4.16, 4.18, 4.19, 6.3, 7, 8.4), `REQUIREMENTS-Client-Input.md` (FR-230 to FR-249, not yet applied), `REQUIREMENTS-D053.md` (FR-294 to FR-308), `DECISIONS-PENDING.md` to `DECISIONS-PENDING-4.md` (D-044 to D-053).

## What this file is

An addendum for one new feature: ComfyUI as a generation provider (D-050). It says what is needed. It does not say how to build it.

The stakeholder's first words on it:

> "One feature we should definitely add, both for end users and for cheaper testing once we verify our provider setups work - we need a comfyui provider option. The settings can allow the user to paste a comfyui url (url on their own machine or over the network) to do generative runs via the comfy API. And we need workflows relevant to this project"

The stakeholder then answered three rounds of questions. The answers are in Section 6.1, word for word. Section 0 says what they changed.

Requirement numbers FR-250 to FR-291 are kept from draft 3. FR-292 and FR-293 are new in draft 4. They would form a new Section 4.21 of `REQUIREMENTS.md`. Some reach beyond ComfyUI and belong elsewhere when applied: FR-279 to FR-281 and FR-292 (Sections 4.7 and 4.18). FR-287 is replaced by FR-303 to FR-305 in `REQUIREMENTS-D053.md`.

---

## 0. Changes after the stakeholder's answers

### 0.1 Draft 4: what changed, by requirement

"Item" is the number of the answer in D-053 (Section 6.1, third table).

| Requirement | Change | Item |
|-------------|--------|------|
| FR-251 | An address that fails the check is refused, wherever it comes from. No extra message is needed for one found in stored settings. Closes OI-50. | 4 |
| FR-258, FR-288 | "Krea2" provides alternate workflows. FR-288 is now P1 (proposed). | 9 |
| FR-261 | "Moss Image" is tried first. "Krea2" is the alternate. | 9 |
| FR-262 | A result of 768×1344 from the video model is acceptable. The clip keeps its sound. | 15, 12 |
| FR-276 | An encrypted address whose certificate the computer does not trust is refused. | 16 |
| FR-279 | Unticking does not touch runs already waiting or running. | 8 |
| FR-280 | Limit on active agent runs (FR-292). No spending cap. | 8 |
| FR-281 | A paid run that is charged whether or not it is stopped is left to finish. | 8 |
| FR-283 | Reversed. A stored ComfyUI video keeps the sound the model made. | 12 |
| FR-286 | Now the rule for every video provider, not only ComfyUI. Each offers the kinds of start its service has. | 11 |
| FR-287 | Replaced by FR-303 to FR-305 in `REQUIREMENTS-D053.md`. | 10 |
| FR-292 (new) | At most 4 agent-started runs active at once by default. The user can change the number. | 8 |
| FR-293 (new) | An optional step that enlarges a finished video. | 15 |
| Section 3.3, Tests | `COMFY_BASE_URL` is in `.env.local`. | 13 |
| Section 4 | "Sound" removed from out of scope. | 12 |
| Section 5.6 (new) | Add-ons: what each planned job needs outside ComfyUI's own parts. Answers "What community add-ons are you thinking of?" | 9 |
| Section 5.7 (new) | Cut-out in ComfyUI (for FR-307 in `REQUIREMENTS-D053.md`). | 25 |
| Section 9 | ComfyUI video is built before fal video. An agent drafts workflow files for the stakeholder to test. | 17, 14 |
| Priorities | FR-250 to FR-267, FR-269 to FR-286, FR-289, FR-290 and FR-292 are P0. FR-268, FR-288, FR-291 and FR-293 are P1. FR-287 is replaced. | |

### 0.2 Conflicts with `REQUIREMENTS.md` to correct later

`REQUIREMENTS.md` was not edited. Each row is a place where it now disagrees with the stakeholder's answers. Rows marked "D-053" are new or changed in draft 4. More conflicts from D-053 that are not about ComfyUI are in `REQUIREMENTS-D053.md`, Section 3.

| Where | What it says today | What the answers need | Answer |
|-------|--------------------|-----------------------|--------|
| FR-199 | An agent cannot start image or video generation in this build. | An agent may start runs for a provider when the user has ticked that provider's setting (FR-279). Export and publish stay as they are. | 5 |
| Section 1.4, out of scope: "An external agent starting paid image or video generation ..." | Out of scope, deferred. | No longer true. A paid provider that supports cancelling can have the tick (FR-279). The limit is FR-292. There is no spending cap. | 5, 20, D-053 item 8 |
| OI-06 (D-053) | Open: decide whether an agent may later start generation, export or publish. | Decided for generation: yes, by the tick, for providers that support cancelling, paid ones included, at most 4 active runs by default (FR-292). Export and publish still open. | 5, 20, D-053 item 8 |
| FR-065 | "All image and video generation is started by the user in the app". | Add the exception: or by an agent, for a provider the user has ticked. "One variant at a time" stays. | 5 |
| FR-123 (D-053) | The app can generate a video "from a variant's finished background image", and it "is started by the user". | Rewritten in `REQUIREMENTS-D053.md`: start choices for every video provider that has them (FR-286), and the agent exception. | 5, 19, D-053 item 11 |
| Workflow 5.5, "Make a video variant" | Written for a video made from the variant's background. | Must allow a video with no start frame, and reference pictures on a video run (FR-286), for every video provider. | 19, D-053 item 11 |
| FR-062 | The generation panel attaches the subject's reference files. Written for pictures. | For a video the user also chooses the start frame or none, and whether reference pictures are used (FR-286). | 19 |
| FR-064, FR-067 | A confirmation dialog comes before each run. | An agent-started run has no dialog (FR-280). The dialog stays for every run the user starts. For a video it also shows the start choice (FR-286). | 5, 19 |
| The note that reads "An agent cannot start generation (FR-199), so generation still starts only when the user asks for it" (under the brief confirm requirement, Section 4.3) | Generation only when the user asks. | No longer true once a tick is set. | 5 |
| FR-200 | Agent edits follow the same rules as user edits. | Should name agent-started runs and point to FR-280 and FR-292. | 5 |
| Section 8.4, threat notes and "never exposed to an agent" lines (D-053) | Written for an agent that cannot cause any outbound generation. | An agent can now cause prompts and pictures to be sent to a provider the user ticked, and for a paid provider it can cause spending, with no spending cap. The limit on active runs (FR-292) is the only brake. The address and keys stay out of the agent's reach (FR-272, FR-198). | 5, 20, D-053 item 8 |
| FR-069 | "Raw error codes are never shown." | Exception for ComfyUI: the server's own message can be shown when the user asks for it (FR-267). | 9 |
| FR-152 | The activity panel lists jobs "with status and retry". | Add a cancel action and a "cancelled" status (FR-281). | 10 |
| FR-124, FR-215, FR-216, FR-218 | No cancel and no "cancelled" state for a generation. | A cancelled run is neither running nor a finished result waiting to be looked at (FR-281). | 10 |
| Section 8.9, Activity panel and Panels and dialogs | No cancel action. | Add it. | 10 |
| Section 6.3 and 8.4 | Prompts and pictures go only to fixed, built-in provider addresses. Nothing is said about an unencrypted connection. | One exception: the ComfyUI address the user typed, which may be unencrypted to another computer with no warning (FR-276). | 6 |
| FR-230 (`REQUIREMENTS-Client-Input.md`, not yet applied) (D-053) | Counts "paid generations" that the app sent, per campaign. | Must say that a run on a local provider or model is never counted (FR-257). Rewritten in `REQUIREMENTS-D053.md` with an estimate of money. | 14, D-053 item 10 |
| FR-170 to FR-172, the key rules (D-053) | A key is entered in the app and used for generation. | A second, wider key may be saved to read a provider's own usage figures (FR-304 in `REQUIREMENTS-D053.md`). | 21, D-053 item 10 |
| FR-132 and Section 1.4 "All video is silent" (D-053) | Video has no sound. | Generated video keeps its sound (FR-283 here; FR-300 to FR-302 in `REQUIREMENTS-D053.md`). | D-053 item 12 |
| IR-002 (D-053) | Seedance through fal is the named video route. | ComfyUI video is a second route. The two are "equally important". ComfyUI video is built first (Section 9, L-1). | 3, 25, D-053 item 17 |
| IR-002 and Section 9.3 | Names the models and their terms for the paid providers. | Add the three ComfyUI models, and the rule that the licence is the user's responsibility and the app says so (FR-285). | 16, 18 |
| Section 7, integration table | No ComfyUI row. | Add one: user-typed address, outbound, no key. | D-050 |
| D-049 (standing rule "never run live tests") | Applies to every live test. | Unchanged for paid providers. Project agents may run ComfyUI tests without asking each time (Section 3.3, Tests). | 7, 22 |
| D-044 | Lists the names in the private test settings. Only `test:live` reads the file. | One more name: `COMFY_BASE_URL`, in `.env.local`. "Agents never open the file" stays. Which test run reads the name is for the architect. | 24, D-053 item 13 |
| D-048, the hand-test screen | No ComfyUI part. | Gets one (FR-290). | 23 |
| Spec 6.11, job runner, "three per provider" (D-053) | Three runs at once for each provider. | Agent-started runs are limited to 4 by default (FR-292). The two limits must be made to agree. For the architect. | D-053 item 8 |

### 0.3 Findings the stakeholder should see first

These come from the public pages read on 2026-11-20 (Section 5). Items 1 to 3 are new in draft 4.

1. **No community add-on is needed for the first build, as far as read.** The video model, the stills model, Krea 2 pictures from a prompt, a video enlarger (SeedVR2) and cut-out (BiRefNet) are all described as built into ComfyUI. The one job that needs an add-on is extending a picture with Krea 2. See Section 5.6 and CQ-35.
2. **A built-in video enlarger exists.** ComfyUI's page says "SeedVR2 is natively supported in ComfyUI". Its licence is Apache 2.0. Whether it fits the 24 GB card together with the video model, and whether it keeps the clip's sound, is not stated (U-29). See FR-293.
3. **The video model's own 2K step is a paid, hosted step.** It is not a local one and stays out of scope (Section 4).
4. **"Krea2" was found as "Krea 2", from Krea AI. Its free licence allows commercial use only for companies with less than $1,000,000 a year in revenue.** Above that, a paid licence from Krea is needed. The price is not published (V-31). The licence also asks whoever runs the model to filter harmful content. The rule of FR-285 is applied to it (A-C16).
5. **ComfyUI's own pages for Krea 2 show two workflows: a picture from a prompt, and a picture that copies the style of a reference picture.** Neither extends a picture. The reference is for style and mood, not for keeping a product recognisable (V-30).
6. **Gemini: no documented way to cancel a started picture request was found.** By the rule in answer 20, Gemini gets no agent tick. See CQ-34.
7. **fal: cancelling is documented, with a limit.** A waiting request is removed. A running request is sent a stop signal and "may still complete" (V-34). The stakeholder's answer: "If fal charges you either way then just let it finish" (FR-281).
8. **A video file kept only for a short time: no built-in way was found.** ComfyUI's own video save step always writes to the output folder (V-38). See FR-291.
9. Still standing from draft 2: the video model's free licence does not cover commercial use in the US, EU, UK or South Korea (V-25). The stakeholder has answered this: it is left to the user (FR-285).

### 0.4 Draft 3: what changed, by requirement (kept for the record)

Answers 16 to 26.

| Requirement | Change | Answer |
|-------------|--------|--------|
| FR-254 | A video is offered with or without a start frame, and with or without reference pictures. | 19 |
| FR-258 | A third model is named: "Krea2". | 18 |
| FR-260 | Settled as far as it can be without a trial: it uses a "Moss Image" workflow that takes reference pictures. A trial decides. If it fails, another model is chosen later with the stakeholder. | 17 |
| FR-261 | Extend a background is done with "Moss Image" or with "Krea2". | 18 |
| FR-262 | The start of a video follows FR-286. | 19 |
| FR-271 | Linked to the test rule FR-289. | 24 |
| FR-279 | The tick is offered for every provider that supports cancelling, paid ones included. | 20 |
| FR-281 | Notes say what the public documents say about cancelling for Gemini and fal. | 20, 21 |
| FR-282 | A saved video file on the server is acceptable in the first build. | 26 |
| FR-285 (new in draft 3) | The app says that commercial use of a model's output may need a licence, and that holding one is the user's responsibility. It does not block. | 16 |
| FR-286 (new in draft 3) | What a video starts from: a first frame or none, with or without reference pictures. A prompt-only video is valid. | 19 |
| FR-287 (new in draft 3) | Usage for a paid provider is read from the provider, through the user's API key. (Replaced in draft 4.) | 21 |
| FR-288 (new in draft 3) | "Krea2" is a supported model. | 18 |
| FR-289 (new in draft 3) | Tests never clear the test server's queue, history or files. The test server may also be a production server. | 24 |
| FR-290 (new in draft 3) | The hand-test screen gets a ComfyUI part. | 23 |
| FR-291 (new in draft 3) | Look for a way to keep a video file on the server temporary, so host storage is not used up. | 26 |
| Section 3.3, Tests | Project agents may run ComfyUI tests without asking each time. ComfyUI only. | 22, 24 |
| Section 4 | Removed from out of scope: an agent starting runs on a paid provider. | 20 |

### 0.5 Draft 2: what changed, by requirement (kept for the record)

Answers 1 to 14.

| Requirement | Change | Answer |
|-------------|--------|--------|
| FR-254 | ComfyUI is offered for pictures, extend-a-background and video in the first build. | 3, 8 |
| FR-256 | The confirmation dialog applies to runs the user starts. An agent-started run has no dialog (FR-280). | 5 |
| FR-257 | A run on a local provider is not counted in the campaign's generation total. The "started by the user" rule now has the agent exception. | 5, 14 |
| FR-258, FR-259 | Shipped workflows only. The models are named. | 1 |
| FR-261, FR-262 | P1 to P0. | 3, 8 |
| FR-263 | Notes give the file names read in the public documents. | 1, 2 |
| FR-267 | The server's own error text is available on request. | 9 |
| FR-270 | Now the ComfyUI case of the general cancel rule, FR-281. | 10 |
| FR-271 | Results are no longer said to stay on the server. Uploaded reference pictures still do. | 11 |
| FR-272, FR-275 | An agent may start ComfyUI runs when the user has ticked the setting. The address half is unchanged. | 5 |
| FR-276 | An unencrypted connection to another computer is allowed with no warning and no accept step. | 6 |
| FR-278 | Workflows come only from the shipped set. | 1 |
| FR-279 to FR-284 (new in draft 2) | The agent tick; rules for agent-started runs; cancelling for every provider that allows it; results without a copy in the output folder; silent video (reversed in draft 4); the build does not wait for models. | 5, 10, 11, 1, 2 |
| Section 4 | Confirmed out of scope: the user's own workflows, servers with a sign-in, more than one address. | 1, 4, 12 |

---

## 1. Summary

ComfyUI is a free program that makes pictures and video with AI models. It runs on a computer the user controls: their own machine or another machine on their network. It can be driven by other programs over the network.

The feature: in Settings the user pastes the address of a ComfyUI server. ComfyUI then appears as one more provider the user can choose for a generation run. The app sends the run to that server and brings the result back, as it does for any other provider.

A ComfyUI server does not take a prompt directly. It takes a "workflow": a recipe that says which models to load and which steps to run. The app ships workflows made for this project's jobs. The user cannot add their own in this build.

**Who it is for**

| Who | Why |
|-----|-----|
| End users who run their own ComfyUI | Generate without a paid account, on their own hardware, with pictures and prompts staying on machines they control. |
| The project's own testing | Exercise the generation features many times without paying a provider for each run. The stakeholder's words: "Comfy is a priority so we can repetitively test the system without incurring costs". |
| External agents | Start runs unattended, for example overnight, on a provider the user has allowed. The stakeholder's words: "I would like an agent to be able to do those runs overnight since they're running for free on my own hardware". |

**What makes it different from every other provider in the app**

- The address is typed by the user. Every other provider talks to one fixed, built-in address and refuses any other. This is the first exception, so Section 3 says what the user must be protected from.
- There is no key and no bill from the app's side. The cost is the user's own hardware and time, and whatever the model's licence asks (FR-285).
- What the server can do depends on which models the user has installed on it. The app cannot install them.
- The server may be shared with other people and other jobs.

**The models the stakeholder named**

| Job | Name as given | Name in public documents |
|-----|---------------|--------------------------|
| Stills, stills with reference pictures, extend a background | "Moss Image" (also written "MOSS", "Moss") | "MOSS-Image", from OpenMOSS |
| Video | "Minimax H3" | "MiniMax H3", from MiniMax |
| Alternate workflows | "Krea2", "Krea 2" | "Krea 2", from Krea AI (versions "Raw" and "Turbo") |

The stakeholder's words on the video model (D-053 item 7): "I believe it's the local H3 model." The stakeholder wrote "Krea 2" in D-053 item 9, which matches the public name.

**The test machine**

One RTX 3090 graphics card (24 GB). It is the stakeholder's own machine. It is the project's ComfyUI test server. The stakeholder's words: "my 3090 machine is our comfy test server, I will likely use it in production as well". So it may hold real work, and tests must leave that work alone (FR-289). The video model is installed on it. The stills model is not: "MOSS is not yet installed" (D-053 item 7, FR-284).

---

## 2. Functional requirements (proposed Section 4.21, ComfyUI Provider)

### 2.1 The address

**FR-250:** Settings has a ComfyUI entry where the user enters the address of one ComfyUI server. The server can be on the same computer or on another computer the user's computer can reach over a network. The user can change the address or remove it.
**Priority:** P0
**Notes:**
- The stakeholder's words: "paste a comfyui url (url on their own machine or over the network)".
- One address. Decided (answer 12: "One").
- The address is entered inside the app, as keys are (FR-170). The user never edits a settings file.

**FR-251:** When the user saves an address the app checks its form. An address that fails the check is refused: it is not saved and it is never used. The app tells the user that the address is not valid. An address that carries a sign-in name or password inside it is not accepted. The same check applies to an address the app finds in its own stored settings: one that fails is refused and the app behaves as if no address were saved.
**Priority:** P0
**Notes:**
- The stakeholder's words (D-053 item 4): "It should just refuse a malformed URL (validation fails)". This closes OI-50.
- "Just refuse" is read as: no special message is needed when a stored address is refused. The user sees that no address is set, and types it again (A-C18). In Settings, when the user has just typed the address, the app does say it is not valid, so the user is not left guessing.
- Which forms are accepted (for example with or without a port number, a name or a number address) is for the spec. The address a ComfyUI server prints when it starts must be accepted as pasted. An unencrypted address is accepted (FR-276).
- Only plain servers count in this build (answer 4: "Plain only for now"). So there is no sign-in to carry.

**FR-252:** The user can ask the app to check the saved address. The check gives one of these answers in plain words: a ComfyUI server answered; nothing answered at that address; something answered but it is not a ComfyUI server; the server asked for a sign-in the app cannot give. The check sends no prompt and no picture and starts no generation.
**Priority:** P0
**Notes:**
- This is not a change to FR-172 ("a key is not tested when entered"). An address is not a key, and checking it costs nothing.
- The check runs when the user asks. Whether it also runs once when the address is saved is for the design.
- When a ComfyUI server answers, the check also reports what the server is missing for each workflow (FR-263).

**FR-253:** The ComfyUI address is kept with the app's settings on the user's computer, outside any project. It is never written into a project file, a packaged project (FR-008), a generated file's metadata (FR-068), an export report (FR-150) or anything published to cloud storage. The user can see the saved address in full.
**Priority:** P0
**Notes:** An address is not a secret (D-047 covers only literal secrets), but it can reveal the names of machines on a private network. Projects and generated files are shared between people (8.4), so it stays out of them.

### 2.2 Choosing ComfyUI for a run

**FR-254:** ComfyUI is listed as a provider for every AI job it has a workflow for (FR-258): a picture from a prompt, a picture from a prompt and reference pictures, extending a background, and a video (with or without a start frame, with or without reference pictures, FR-286). The user can set it as the default for those jobs in Settings and can choose it for one run on the confirmation dialog (FR-067). For AI jobs it has no workflow for, it is not offered.
**Priority:** P0
**Notes:**
- Pictures and video are both in the first ComfyUI build (answer 3: "Both"). Extend-a-background is included (answer 8: "Yes extend background included").
- If a job has no proven workflow when the build ships (FR-260, FR-261, FR-286), ComfyUI is not offered for that job and the app does not pretend otherwise.

**FR-255:** ComfyUI needs no key. When no address is saved and the user chooses ComfyUI for a run, the app asks for the address at that moment (as FR-171 does for keys). The rest of the app works with no ComfyUI address saved.
**Priority:** P0

**FR-256:** For a ComfyUI run that the user starts, the confirmation dialog shows, as well as the generation count (FR-064): the address the run will be sent to, and the workflow that will be used. The run starts only after the user confirms.
**Priority:** P0
**Notes:**
- Showing the address at each run lets the user notice an address they did not choose (Section 3).
- For a video the dialog also shows what the video starts from (FR-286), and whether the optional enlarging step is on (FR-293).
- When a job has an alternate workflow (FR-288), the dialog shows which one is chosen.
- A run an agent starts has no dialog. FR-280 says what stands in its place.

**FR-257:** A ComfyUI run follows every rule that applies to a generation run from any provider: it is for one variant at a time (FR-065); it produces the number of options asked for (FR-063); it keeps running while the user works elsewhere (FR-215); its result is kept until dealt with (FR-216); it is shown with its campaign, variant and layer and with running and finished marks (FR-217, FR-218); it is listed in the activity panel (FR-152). It is started by the user, or by an agent under FR-279 and FR-280. A run on a local provider or model is never counted in the campaign's generation total (FR-230).
**Priority:** P0
**Notes:**
- The options of one run must differ from each other. Running the same request twice must be able to give different results.
- The stakeholder's words on counting: "No don't count local providers/models towards usage". This is wider than ComfyUI. It covers any provider that runs on the user's own hardware. Today ComfyUI is the only one.

### 2.3 Workflows for this project

**FR-258:** The app comes with a set of ComfyUI workflows made for this project's generation jobs. The user can use them without opening ComfyUI's own screen and without editing any file. In this build the shipped workflows are the only ones the app can run. The stills workflows use the model the stakeholder named as "Moss Image". The video workflows use the model the stakeholder named as "Minimax H3". The model the stakeholder named as "Krea2" provides alternate workflows (FR-288).
**Priority:** P0
**Notes:**
- The stakeholder's words: "we need workflows relevant to this project", and "Shipped workflows only for now, we should plan on Minimax H3 for video with images references and Moss Image for stills".
- "For now" means the user's own workflows may come in a later build. Nothing in this build should rule that out.
- The video model is the one that runs on the user's own hardware (D-053 item 7), not the paid hosted versions (V-26).
- "Moss Image" has two versions, "Base" and "SFT" (V-21). Which one is left to the architect after a trial (Section 9, L-8).
- The workflow files are being drafted by an agent for the stakeholder to test (D-053 item 14; Section 9, L-7).

**FR-259:** Picture from a prompt. A shipped workflow makes a background picture from the prompt in the generation panel (FR-062) at the variant's ratio. It must work for the default sizes 1080×1080 (1:1), 1080×1920 (9:16) and 1920×1080 (16:9), and for a custom ratio or pixel size the user has added to the campaign (FR-032).
**Priority:** P0
**Notes:**
- When the model cannot make the exact pixel size asked for, the result still has the variant's ratio, and the app treats the difference in size the same way it does for any other provider.
- The public documents say the named model's width and height must be multiples of 16 and that it works best between 1 and 2 megapixels (V-22). 1080 is not a multiple of 16. So the exact default sizes cannot be asked for directly, and the rule above applies from the first run.
- The picture model is asked not to draw text, as for every provider (FR-061). The app cannot guarantee that a local model obeys.

**FR-260:** Picture from a prompt and reference pictures. A shipped workflow takes the prompt and the subject's reference files that the generation panel attached (FR-062), and makes a picture that uses them. It uses a "Moss Image" workflow that takes reference pictures. The reference files are sent to the server only as part of a run the user has confirmed, or a run an agent started under FR-280.
**Priority:** P0
**Notes:**
- The stakeholder's words: "If Moss ends up being a dead end for reference images we can try something else, but the results I've seen look quite good, so we should try one of the image reference workflows".
- A trial on a real server decides whether the workflow keeps a product recognisable well enough (U-17). Until the trial passes, ComfyUI is not offered when reference pictures are attached, and the app says why (FR-254).
- If the trial fails, another model is tried. Which one is chosen later, with the stakeholder. It is not chosen here.
- What the public documents say: the model on its own "has no image input, so it cannot copy a reference". A separate "Image Edit" workflow for the same model takes a photo, an instruction and up to four reference pictures (V-23). Which "Moss Image" workflow is used is for the architect.
- Without this the ComfyUI provider cannot show the user's own product, which is the main use of reference files.
- When the user has attached more reference pictures than the workflow can use, the app says so before the run and does not drop any silently.
- A reference picture in a form the workflow cannot take, for example WebP, is turned into one it can take before it is sent (FR-298 in `REQUIREMENTS-D053.md`).

**FR-261:** Extend a background. A shipped workflow extends a background picture to a new ratio, for the "generate fill" choice in fan-out (FR-076). It uses "Moss Image". "Krea2" is the alternate (FR-288).
**Priority:** P0
**Notes:**
- Decided (answer 8: "Yes extend background included"; answer 18: "Extend an image can be done with MOSS or with Krea2"; D-053 item 9: "Krea 2 can provide alternate workflows").
- "Moss Image" is tried first, because it is the stills model already and is not known to need an add-on. This is the analyst's reading of "alternate" (CQ-36).
- What the public documents say. "Moss Image": no documented way to extend a picture was found (U-13). The stakeholder says it can be done; a trial decides. "Krea2": ComfyUI's own pages show no way (V-30). A community add-on with an "outpaint" workflow exists (V-33). It was read on a third-party page only, and it needs an add-on on the server (Section 5.6, CQ-35).
- Until a way is proven on a real server, ComfyUI is not offered for generate fill (FR-254).

**FR-262:** Video. A shipped workflow makes a video clip for a variant using the named video model, with the rules of FR-124 (background job, visible status, the variant keeps what it had on failure). What the video starts from follows FR-286.
**Priority:** P0
**Notes:**
- Decided (answer 3: "Both").
- A variant has no maximum duration (FR-120). The public documents give about 15 seconds as the longest clip for this model (V-19). The app must tell the user before the run how long a clip the workflow can make when that is shorter than the variant's duration.
- The model makes clips of about 1 megapixel on local hardware (V-19), for example 768×1344 for a 9:16 variant. The default video sizes are about 2 megapixels. The stakeholder's words (D-053 item 15): "It will have to be acceptable". So a clip is smaller in pixels than the variant, and the app treats that the same way it does for any other provider (A-C3). An optional step can enlarge it (FR-293).
- The clip keeps its sound (FR-283).

**FR-286:** What a video starts from. A video run can start from a first frame or from no start frame. In either case it can be made with or without reference pictures. A video made from the prompt alone, with no start frame and no reference pictures, is a valid run. The app does not refuse it and does not warn against it. The user chooses before the run, and the choice is shown on the confirmation dialog (FR-256). This holds for every video provider. Each provider offers the kinds of start that its service has. A kind a provider does not have is not offered for that provider, and the app says so.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Comfy video can start from first frame or no starting frame, with or without references. User might be prompting for something abstract or a plain background and that's fine". And on fal (D-053 item 11): "Yes fal should offer the same options whatever available."
- This gives four kinds of run: first frame only; first frame and reference pictures; reference pictures only; prompt only.
- When a first frame is used, it is the variant's finished background picture, as FR-123 says today. Whether the user may pick a different picture as the first frame was not said, and is not assumed.
- Reference pictures are the subject's reference files (FR-062). They are sent to the provider under the same rule as in FR-260.
- What the public documents say for ComfyUI: the named model has three example workflows: prompt to video, picture to video, and reference pictures to video, with up to nine pictures (V-18). Not verified: that one run can take a first frame and reference pictures together (U-20).
- What the public documents say for fal: its video model is offered as prompt to video, picture to video (with an optional last picture) and reference to video (V-40, read in a search summary). Not verified: a first frame and reference pictures in one run.
- A first frame of a different ratio is stretched to fit by the ComfyUI model's own workflow (V-18). The app must not send a first frame that would be distorted without telling the user.
- This is wider than FR-123 in `REQUIREMENTS.md`. FR-123 is rewritten in `REQUIREMENTS-D053.md`. It also touches workflow 5.5, FR-062, FR-064 and FR-067 (Section 0.2).
- Which start is selected when the dialog opens was not said. Proposed, for the design: the variant's finished background as first frame when the variant has one, since that is what the app does today (A-C19).
- An agent that starts a video run (FR-280) makes the same choice the user would.

**FR-293:** Optional video enlarging. A shipped video workflow can include a step that enlarges the finished clip toward the variant's pixel size. The step is optional: the user turns it on or off before the run, and it is off unless the user turns it on. The confirmation dialog shows whether it is on (FR-256). What the step needs on the server is listed like any other need (FR-263). When the server lacks it, the step is not offered and the video can still be made without it.
**Priority:** P1
**Notes:**
- The stakeholder's words (D-053 item 15): "maybe we should add an optional video upscaler to the workflow as well."
- "Off unless turned on" is the analyst's proposal: the step adds time and memory use, and the test machine has one 24 GB card.
- The enlarged clip must keep the clip's sound (FR-283). Not verified: that the enlarging step found today passes sound through (U-29). If it does not, the workflow must put the sound back.
- What the public documents say: "SeedVR2 is natively supported in ComfyUI", with a ready "Upscale Video" workflow, in two sizes (3B and 7B), under the Apache 2.0 licence (V-41). So no add-on is needed, as far as read. Not verified: that it fits a 24 GB card in the same run as the video model, and how long it takes (U-29).
- The video model's own "2K" step is a paid hosted step (V-26, V-42). It is out of scope (Section 4).
- An agent that starts a video run can turn the step on or off as the user can (FR-280).

**FR-263:** Each shipped workflow states what it needs on the server: every model file by its exact file name, the folder it belongs in, the oldest ComfyUI version it works with, and any add-on the server must have. The user can read this list in the app before any run. When a ComfyUI server answers (FR-252), the app compares the list with what the server reports and names each missing item.
**Priority:** P0
**Notes:**
- A ComfyUI server can be asked which model files and which building blocks it has (V-7). So the comparison is possible without starting a run.
- The app does not download or install models (Section 4). The list is what the user needs to do it themselves.
- The public documents name the files for all three models (V-17, V-21, V-29). The first two are described as supported by ComfyUI itself. No page says in so many words that no add-on is needed (U-12). Section 5.6 lists what is known per job.
- The models need different ComfyUI versions (V-17, V-21, V-29). A server that has one model working may still be too old for another.

**FR-264:** A picture or video made through ComfyUI is stored and treated like any other generated asset. It carries provider, model and prompt in its own metadata (FR-068), with "ComfyUI" as the provider, the model file names the workflow used, and the name and version of the workflow. It does not carry the server's address (FR-253).
**Priority:** P0
**Notes:**
- Generated pictures are stored as PNG whatever the server returns, as for other providers. Confirmed (D-053 item 21: "Correct"; FR-299 in `REQUIREMENTS-D053.md`).
- A ComfyUI server writes its own generation details into the files it makes. What the app stores must follow FR-068 and FR-253 whatever the server wrote.

**FR-283:** A video the app stores from a ComfyUI run keeps the sound the model made with it. When the model made no sound, the clip is silent and that is not a fault.
**Priority:** P0
**Notes:**
- The stakeholder's words (D-053 item 12): "Why not keep sound? For fal as well."
- Reversed in draft 4. Before: "has no sound, whatever the model produced".
- The named video model makes sound together with the picture, in one file (V-20).
- The rule for every video provider, and what the user can do with the sound on a video variant, is in `REQUIREMENTS-D053.md` (FR-300 to FR-302).
- Sound is the model's own output. It can hold speech or music the user did not ask for. The user can switch a clip's sound off (FR-301).

**FR-284:** The build of this feature does not wait for any model to be installed. Everything in this file can be built, and its normal tests pass, on a machine with no ComfyUI server and no model files. When a model a workflow needs is missing on the server, the app behaves as FR-263 and FR-266 say. Each workflow's check on a real server (Section 3.3, Maintainability) is done once its model is installed, and the feature is not called finished for that job until it is.
**Priority:** P0
**Notes:**
- The stakeholder's words: "My test machine does have Minimax but not moss installed. GPU is a 3090. We can finish installation on that end later but will wanna get everything built out for this to run in the meantime". Still so on 2026-11-20: "MOSS is not yet installed".
- The test machine: one RTX 3090, 24 GB. Whether each model's working set fits that card is not verified in public documents (U-11, U-21).

**FR-285:** Where the app describes a shipped workflow, it says when the model's licence may limit commercial use of what the model makes. It says that commercial use may need a licence, that getting and holding that licence is the user's responsibility, and where the licence can be read. The app does not check for a licence. It does not block or slow any run because of it.
**Priority:** P0
**Notes:**
- The stakeholder's words: "That's fine we can leave it to the user to know they've obtained a Minimax license."
- The answer names the video model. The requirement is written for any shipped workflow whose model has such a limit, so that "Krea2" is covered in the same way (V-31, A-C16).
- The user can read the statement before the first run with that workflow, for example with the list of FR-263. Where exactly is for the design.
- The app states what the licence page says. It gives no legal advice.

**FR-288:** The model the stakeholder named as "Krea2" provides alternate workflows. For a job that has a "Krea2" workflow as well as the main one, the user can see which workflow a run will use and can choose the other. The main workflow is selected unless the user chooses otherwise.
**Priority:** P1 (proposed)
**Notes:**
- The stakeholder's words: "Extend an image can be done with MOSS or with Krea2, which is another interesting one to support", and (D-053 item 9) "Krea 2 can provide alternate workflows."
- "Alternate" is read as: a second choice beside the main workflow for the same job, not a replacement for it.
- Which jobs get an alternate is not said (CQ-36). By the public documents "Krea 2" can make a picture from a prompt, and a picture in the style of a reference (V-30). It can extend a picture only with a community add-on (V-33).
- Choosing between two workflows for one job is new. Before, each ComfyUI job had one workflow.
- FR-263, FR-264, FR-266 and FR-285 apply to its workflows as to any other.
- An alternate workflow does not hold up the first build (FR-284).

### 2.4 When something goes wrong

**FR-265:** Server unreachable. When the app cannot reach the address at the start of a run, no run starts, and the app says in plain words that nothing answered at that address, shows the address, and offers retry and a way to Settings. The user gets this answer within a fixed time, not after an open-ended wait.
**Priority:** P0
**Notes:** The length of the wait is for the spec. The same answers as FR-252 apply: nothing answered, not a ComfyUI server, sign-in needed.

**FR-266:** Missing model or add-on. When the server lacks something the chosen workflow needs, the run does not start. The app names each missing item (for a model: its file name and the folder it belongs in) and tells the user that they must add it to the server themselves.
**Priority:** P0
**Notes:** This must be caught before the server starts work whenever the server can tell (FR-263), not as a failure halfway through.

**FR-267:** Failure during a run. When a run fails after it has started, the variant or layer keeps what it had, and the app shows a plain-language reason and a retry action (FR-069, FR-124). The app tells these cases apart at least: the server ran out of memory; the server refused the request; the server stopped or the connection was lost; the run took longer than the app waits. The plain message comes first. The server's own message is available when the user asks for it. Options that finished before the failure are kept and offered to the user.
**Priority:** P0
**Notes:**
- Decided (answer 9: "Yes"). The question was whether the app may show the ComfyUI server's own error text. The analyst reads "Yes" as the recommended form: plain message first, the server's words on request. This is an exception to FR-069 for ComfyUI only.
- The server's own message is shown as plain text and never acted on (FR-277).
- "Kept options" follows what the app does for a part-finished run from any provider. If the app has no such rule yet, this is new.

**FR-268:** Lost contact. A short break in the connection during a run does not by itself make the run fail. When contact comes back, the app picks the run up where the server has it. When contact does not come back within a fixed time, the app reports the run as lost contact, and says that the server may still be working on it.
**Priority:** P1
**Notes:**
- Video runs on local hardware can take many minutes. A laptop that sleeps or a brief network drop should not waste the work.
- This matters more now that agents may start runs overnight (FR-280). Whether it becomes P0 is still open (CQ-34).
- If results come back only over the live connection (FR-282), a break at the wrong moment can lose a finished result that the server did not keep. The app must then say the result was lost and offer retry. It must not show a half result as finished.

### 2.5 Progress and cancelling

**FR-269:** While a ComfyUI run is in progress the user can see whether it is waiting in the server's queue or being worked on, and how far along it is whenever the server reports that. This is shown wherever the run is shown (FR-152, FR-217).
**Priority:** P0
**Notes:** A ComfyUI server reports queue position and step-by-step progress (V-4). A run can wait a long time behind other people's jobs on a shared server, so "waiting" and "running" must look different.

**FR-281:** The user can cancel a generation run that is waiting or running, for every provider that allows a run to be stopped. The app asks the provider to stop the run. The variant or layer keeps what it had. A cancelled run is shown as cancelled: it is not shown as running, as failed, or as a finished result waiting to be looked at. For a provider that does not allow a run to be stopped, the app says so, and does not show a cancel action that does nothing. A paid run that will be charged whether or not it is stopped is left to finish, and its result is kept and offered like any other result.
**Priority:** P0
**Notes:**
- The stakeholder's words: "We can add for every provider that allows it", and (D-053 item 8) "If fal charges you either way then just let it finish."
- The last sentence is read like this. A waiting paid request that the provider removes without charge is cancelled when the user asks. A paid request that has started, and that the provider would charge for anyway, is not thrown away: the app lets it finish and keeps what was paid for. The app tells the user this is what will happen when they ask to cancel.
- Not verified: whether fal charges for a running request that is cancelled (U-25). Until it is known, the app treats a running fal request as "charged either way".
- `REQUIREMENTS.md` has no cancel for any generation today. This touches FR-152 (the activity panel needs the action and the status), FR-124, FR-215, FR-216, FR-218 and Section 8.9 (Section 0.2).
- Whether a provider supports cancelling also decides whether it can have the agent tick (FR-279).
- What the public documents say, per provider:
  - ComfyUI: a run can be stopped by its ID (V-5).
  - fal: documented. A waiting request "is removed immediately and is never processed". For a running request a stop signal is sent, and "The request may still complete if the app does not handle cancellation" (V-34).
  - Gemini: no documented way to cancel a started picture request was found. Google documents cancelling only for requests started in its "background" mode, and the page does not list picture models for that mode (V-35, U-24).
  - OpenAI pictures (FR-306 in `REQUIREMENTS-D053.md`): not checked.
- So a provider can answer "stop was asked for" and still finish the run. The app must then show what really happened. It must not show "cancelled" for a run whose result arrived and was charged.
- Closing a project while a paid request that cannot be stopped is still out is OI-51. It is still open with the stakeholder. This answer points one way: let it finish.
- What a cancelled paid run costs, and how it is counted, follows FR-303 in `REQUIREMENTS-D053.md`.
- Options that finished before the cancel: proposed the same as for a failure (FR-267), kept and offered.
- Whether an agent may cancel a run is part of CQ-34.

**FR-270:** For ComfyUI, FR-281 applies in full: the user can cancel a ComfyUI run that is waiting or running. Cancelling never stops, removes or changes work on the server that this app did not start.
**Priority:** P0
**Notes:**
- A ComfyUI server can be asked to stop one named run (V-5). Not verified: that this never disturbs another person's run on a shared server (U-3).
- A local run can occupy the user's own machine for a long time, so this matters most here.

**FR-282:** The result of a ComfyUI run comes back to the app without a copy being saved in the server's output folder, wherever ComfyUI allows that. Where ComfyUI does not allow it for a kind of result, the app still brings the result back, and tells the user in Settings which kinds of result leave a copy on the server. For video, a file saved on the server is acceptable in the first build.
**Priority:** P0
**Notes:**
- Answer 11 was cut off: "If you use image previews you should be able to get bytes back without outpu". It is read as "without output files" (A-C7).
- The stakeholder's words on video (answer 26): "If it is required that's fine for this first run, but we should look into how we can temporarily save a video file on the host machine so we don't eat up host storage". The second half is FR-291.
- Verified for pictures: ComfyUI's own example shows pictures returned to the calling program "directly without them being saved to disk" (V-15). ComfyUI's preview step, which the stakeholder named, does write a file, but in the server's temporary folder and not its output folder (V-16). Both meet the words "no copy in the output folder". Only the first leaves no file at all.
- Verified for video: ComfyUI's own video save step "saves the input video to your ComfyUI output directory", and the page shows no option to do otherwise (V-38). No built-in way to get a video back without a saved file was found (U-15, U-28).
- A saved video file is a file the app caused but may not be able to remove (U-4). The app tells the user it is there (FR-271).
- With the enlarging step on (FR-293), a run may leave more than one video file on the server.

**FR-291:** The project looks for a way to keep a video file on the ComfyUI server only for a short time, so that repeated runs do not use up the server's storage. When a way is found that works with a plain server and the shipped workflows, the app uses it. Until then FR-282 applies, and the app tells the user that each video run leaves a file on the server and that they must remove such files themselves.
**Priority:** P1
**Notes:**
- The stakeholder's words: "we should look into how we can temporarily save a video file on the host machine so we don't eat up host storage".
- This is a requirement to find out and then act. It does not hold up the first build.
- What "temporary" must mean was not said: removed when the result has been fetched, removed after some time, or removed when the server restarts. For the architect to propose, and for the stakeholder to accept, once the options are known.
- What the public documents say today:
  - The built-in video save step always writes to the output folder (V-38).
  - A ComfyUI server has a temporary folder. Its place can be set by the server's owner when the server starts. The server's start-up code clears temporary files when it starts, in the normal case (V-39). So a file there lasts until the next restart, not for a fixed time. The body of the clearing step was not read.
  - Steps that write a video preview into the temporary folder were seen only as add-ons from community authors, on third-party pages (U-28). An add-on is something the user must install (FR-263, CQ-35).
  - No documented way to delete one file from the server by request was found (U-4).
- Whatever way is chosen must keep FR-271: the app never removes files it did not put there.
- The need is sharper because the test server is run again and again and may also be a production server (FR-289).

**FR-271:** On the server the app touches only its own work. It shows, fetches and cancels only runs it started. It never clears the server's queue or history, and never removes files from the server that it did not put there. The app tells the user in Settings what it leaves on the server.
**Priority:** P0
**Notes:**
- This holds for the project's tests too, on any server, and above all on the test server (FR-289).
- What is left, as far as verified today: reference pictures and first frames the app uploads are saved in the server's input folder and stay there (V-6). No documented way to remove them was found (U-4). Each video run leaves a video file in the output folder (FR-282, V-38). Picture results follow FR-282.
- Not verified: what the server keeps about a run in its own history, for example the prompt (U-16). The app does not clear it, by the rule above.
- Removing uploaded reference pictures stays out of scope (Section 4). Removing the app's own video files is the subject of FR-291.

### 2.6 External agents

**FR-279:** Settings has a tick, one for each generation provider that supports cancelling (FR-281), that lets external agents start runs for that provider. Paid providers are included. A provider that does not support cancelling has no tick, and agents cannot start runs for it. Each tick is off until the user ticks it. Only the user can tick or untick it, in the app's Settings. An agent cannot change it, and cannot read it through any route that would let it change it. Unticking it stops agents from starting new runs at once. Runs that are already waiting or running are not touched by unticking: they carry on to their end.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Outside agent should be able to start any runs which have a setting ticked in settings, is my new thinking", and (answer 20) "The tick should exist for any providers which support cancelling, I'm not sure if gemini is included in that but if so we should support cancellation there too", and (D-053 item 8) "Unticking shouldn't affect active jobs."
- "Active jobs" is read as runs that are waiting and runs that are running (A-C20). The user can still cancel any of them by hand (FR-281).
- Which providers that means, by the public documents read today: ComfyUI yes (V-5). fal yes: its limited cancel is taken as enough, since the stakeholder's answer on fal assumes fal runs are started by agents (A-C14). Gemini picture generation: no documented way to cancel was found (U-24), so no tick unless a way is found (CQ-34).
- A paid provider with the tick on can spend the user's money with nobody watching. The stakeholder's words: "No spending cap necessary." The limit on active runs (FR-292) is the only brake. Each paid run an agent starts is recorded as started by an agent (FR-280; FR-303 in `REQUIREMENTS-D053.md`).
- Nothing but the user in Settings can set it: not a project file, a packaged project, a brief, an imported file, an agent, or an answer from a server. Same rule as for the address (FR-273).
- Whether an agent may be told that the tick is off, so it can say so to its user, is for the spec. It must never be able to turn it on.

**FR-292:** The app limits how many agent-started runs can be active at one time. A run is active while it is waiting or running. The limit is 4 unless the user changes it. The user can change it in Settings. When the limit is reached, a further request from an agent to start a run is refused with a plain reason, and nothing is sent to a provider. Runs the user starts are not counted and are not held back by this limit. Only the user can change the limit; an agent cannot.
**Priority:** P0
**Notes:**
- The stakeholder's words (D-053 item 8): "4 is a fine default, this can be configurable."
- Read as one number for all providers together (A-C21). Whether it should be 4 for each provider is CQ-34.
- "Refused" and not "kept waiting inside the app" is the analyst's proposal: the agent learns at once and can try again later. For the spec to confirm.
- The job runner in the spec runs three jobs at once for each provider. The two limits must agree. For the architect (Section 0.2).
- There is no spending cap (FR-279). On a paid provider this limit bounds how fast an agent can spend, not how much.
- The smallest and largest number the user may set are for the spec.

**FR-280:** When a provider's tick is on (FR-279), an external agent can start a generation run for that provider through the MCP server, within the limit of FR-292. The run is for one variant at a time, in a project that is open in the app (FR-201). It follows every rule of FR-257. It starts with no confirmation dialog and without the user being present. It is marked as started by an agent wherever it is shown (FR-152) and in the activity log (FR-153). Its result waits for the user as any result does (FR-216, FR-218). When the tick is off, or the provider has no tick, the agent's request is refused with a plain reason and nothing is sent to the provider.
**Priority:** P0
**Notes:**
- "Without the user being present" follows from "overnight". The app must be running, the project open and the MCP server on (FR-191, FR-201).
- For ComfyUI the agent uses the shipped workflows and the ones added on this computer (FR-278), by ID, and the saved address. It cannot name an address, a workflow file or a model file. It may add or remove a workflow only through an ask the user answers (D-104). It can choose an alternate workflow (FR-288) and the enlarging step (FR-293) as the user can.
- For a paid provider the agent uses the user's saved key without seeing it (FR-198). The run is a paid run like any other: it is counted and reported as one (FR-230; FR-303 in `REQUIREMENTS-D053.md`).
- The agent supplies what the user would in the generation panel: the variant, the job, the prompt, the number of options, and for a video the start choice (FR-286).
- Still open (CQ-34): whether an agent may pick one of the options; whether an agent may cancel. Until answered, "its result waits for the user" stands as written.
- Reference pictures go to the provider as part of an agent-started run, as they would for a user's run (FR-260). The user agreed to that by ticking.
- A failed agent-started run is reported to the agent with a plain reason, and is shown to the user as any failed run is.

**FR-272:** An external agent can start a ComfyUI run only under FR-279 and FR-280. An external agent can never read, set or change the ComfyUI address through the MCP server, whatever the tick says.
**Priority:** P0
**Notes:**
- Draft 1 said an agent cannot start a ComfyUI run. Changed by answer 5. This conflicts with FR-199 in `REQUIREMENTS.md` (Section 0.2).
- The address half is a protection (Section 3) and did not change.

### 2.7 Usage for paid providers

**FR-287:** Replaced. See FR-303 to FR-305 in `REQUIREMENTS-D053.md`.
**Notes:**
- Draft 3 said: "For each paid provider, the app reads the user's usage from the provider itself, using the API key the user saved for that provider, and shows it to the user. The figures shown are the provider's own, not the app's estimate."
- Why replaced: by the public documents this cannot be done for Gemini at all, and for fal and OpenAI it needs a second key of a wider kind (`REQUIREMENTS-D053.md`, Section 4.1). The stakeholder's words on hearing this (D-053 item 10): "That's surprising to me. I wonder if there is a better fit then as usage seems like it would be an important figure for a business like our client's."
- The proposed better fit: the app's own record of every paid call with an estimated price, and the provider's own figures beside it where they can be read. The stakeholder has not yet chosen (CQ-30).
- Local runs are never counted (FR-257).

---

## 3. Non-functional and security requirements

### 3.1 What the user must be protected from

Today the app sends prompts and pictures only to fixed, built-in addresses. With this feature it sends them to an address someone typed, and an agent may be the one that starts the sending. These are additions to the threat notes in `REQUIREMENTS.md` 8.4.

**FR-273:** Only the user, in the app's Settings, can set or change the ComfyUI address. Nothing else can: not a project file, not a packaged project opened from someone else, not a brief, not an imported file, not an external agent, and not an answer from the server itself.
**Priority:** P0
**Notes:** Test: open a project made on another machine that has a different ComfyUI address; the address in Settings is unchanged and no request goes to the other address.

**FR-274:** For a ComfyUI run, the prompt, the reference pictures and every follow-up request go to the saved address and nowhere else, and results are fetched from that address only. If the server tells the app to go to a different address, the app does not follow, the run stops, and the user is told.
**Priority:** P0

**FR-275:** The app contacts the ComfyUI address only for one of these: a check the user asked for (FR-252); a run the user started; a run an agent started while the tick was on (FR-280); and the progress, cancelling and result of such a run. It does not contact the address when the app starts, when a project opens, or on a timer when no run is in progress.
**Priority:** P0
**Notes:** This keeps a stale or mistaken address from being called without the user knowing, for example on a different network from the one it was typed on. With the tick on, an agent can cause a call to the address. The user accepted that by ticking. An agent still cannot change where the call goes (FR-272).

**FR-276:** The app accepts an unencrypted connection to a ComfyUI server on another computer. It shows no warning and asks for no acceptance before a run because of it. An encrypted address is accepted too, when the user's computer trusts the server's certificate. An encrypted address whose certificate the computer does not trust, for example one the server's owner signed themselves, is refused, and the app says why in plain words.
**Priority:** P0
**Notes:**
- Decided (answer 6: "Allow plain http to another computer"). Draft 1 proposed a warning the user accepts once. That is removed.
- Decided (D-053 item 16, on refusing self-signed certificates: "Ok"). This closes OI-42.
- A user whose server has such a certificate can use the server's unencrypted address, or make their computer trust the certificate. The app's message says so.
- A ComfyUI server uses an unencrypted connection unless its owner sets it up otherwise (V-8).
- What this leaves open, stated once so the decision is on record: on an unencrypted connection, prompts and pictures can be read or changed by others on the same network. Since plain servers have no sign-in (answer 4), the app has no safe way to reach a server across a network the user does not trust.
- The other protections stay: FR-273, FR-274, FR-275, FR-277, FR-278, and the privacy note in Section 3.3. That note is information where the address is entered. It is not a step the user must pass.

**FR-277:** Everything a ComfyUI server sends back is treated as untrusted, exactly as an answer from any provider is. The same limits on size and type apply to its pictures and video. Text from the server (model names, error messages, file names) is shown as plain text and is never acted on as an instruction, a file path on the user's computer, or a link the app opens.
**Priority:** P0
**Notes:**
- The server may be someone else's machine, or a different program answering at that address. On an unencrypted connection (FR-276) the answer may also have been changed on the way.
- This covers the server's own error text shown on request (FR-267), and anything from the server that is passed on to an agent (FR-280).
- It covers the sound in a video file too (FR-283).

**FR-278:** (Replaced by D-104.) A workflow that runs on the user's server is either one shipped with the app or one added on this computer: by the user choosing a file in the system file picker, or by an external agent only after the user allows it in the app, every time, seeing every node type it uses. A workflow is never taken from a project file, a packaged project, a brief, an imported asset or the server, and a run names a workflow only by an ID that is on this computer.
**Priority:** P0
**Notes:** Design: `spec/comfyui-custom.md`. A workflow tells the server what to run. ComfyUI servers with add-ons installed can be made to do much more than make pictures. A project received from someone else, or an agent, must not be able to run a recipe of its own choosing on the user's server.

### 3.2 Testing on the project's ComfyUI server

**FR-289:** The project's tests against a ComfyUI server follow FR-271 without exception. A test touches only runs that the test itself started. A test never clears the server's queue or history. A test never stops or removes a run it did not start. A test never removes, moves or overwrites a file on the server that it did not put there. This holds for every ComfyUI server a test is pointed at.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Correct my 3090 machine is our comfy test server, I will likely use it in production as well". So the test server may hold real, wanted work at the moment a test runs.
- A test that wants a clean start must not get it by clearing the server. It must cope with other work being in the queue, including waiting behind it (FR-269).
- Tests leave things behind too: uploaded pictures in the input folder (V-6) and one video file per video run in the output folder (V-38). They cannot be removed by any documented request (U-4). Tests should therefore make as few and as small runs as will prove the point, and FR-291 matters for the test server first.
- Test: after a ComfyUI test run, every run and file that was on the server before it is still there and unchanged.

**FR-290:** The hand-test screen (D-048) has a ComfyUI part. With it a developer or the stakeholder can try each ComfyUI job by hand, again and again, at no cost: check the address, see what the server is missing, start each kind of run, watch progress, cancel, and see the result.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Sure, Comfy is a priority so we can repetitively test the system without incurring costs".
- The hand-test screen is a throwaway (D-048). The ComfyUI part is too. It replaces nothing in the real Settings and generation screens.
- It obeys every rule in this file. In particular the address is set only by the user (FR-273), workflows are only the shipped ones and the ones added on this computer (FR-278), and nothing on the server is cleared (FR-289).
- The hand-test screen was removed (P9-14); the real screens with dev tools on stand in for it. A workflow picker is the run dialog's "Workflow" select (D-104).

### 3.3 Other quality requirements

- **Privacy (addition to 6.3):** When ComfyUI is the provider, brief content, prompts and reference pictures are sent to the server at the address the user entered. Whoever runs that server can see them. Uploaded pictures stay on it, and each video run leaves a video file on it (FR-271, FR-282). The app says this where the address is entered.
- **Logging:** The address may appear in the app's logs and activity log (D-047: only literal secrets must be kept out). Runs started by an agent are marked as such (FR-280).
- **Performance:** No target is set for how long a run takes; it depends on the user's hardware. No ComfyUI run blocks the UI (8.1, FR-215). The app must not give up on a run only because it is slow: the wait limits in FR-265, FR-267 and FR-268 must suit a video run on one 24 GB card, with the enlarging step on (FR-293). The numbers are for the spec, to be set after a trial on the test machine.
- **Reliability:** The app works in full with no ComfyUI address saved and with the server switched off (8.2). A failed, cancelled or lost run never leaves a variant or layer worse than before it started. This holds for runs an agent started with nobody watching.
- **Storage on the server:** Repeated runs must not quietly fill the server's disk. In the first build the app tells the user what each run leaves (FR-271, FR-282). FR-291 asks for better.
- **Provider boundary:** ComfyUI sits behind the same provider boundary as every other generator (FR-066, IR-001). Adding it must not change how the rest of the app asks for a picture or a video. Cancelling (FR-281), the agent tick (FR-279), the limit on agent runs (FR-292) and the start of a video (FR-286) are written for providers in general, not for ComfyUI alone.
- **Compatibility:** ComfyUI changes often. The app states which ComfyUI version the shipped workflows were checked against, and the oldest version each needs (FR-263). When the server reports a different version the check (FR-252) says so, as a note and not as a failure. (P1.)
- **Maintainability:** The shipped workflows are part of the app and must be kept working as ComfyUI and its models change. Each one has a stated owner check: the steps to prove it still works on a real server (FR-284).
- **Add-ons:** A shipped workflow uses ComfyUI's own parts wherever they can do the job. An add-on from a community author is code that runs on the user's server, written by someone neither the user nor this project controls. A workflow may need one only where no built-in way works, and the app names it plainly (FR-263). Which add-ons, if any, may be required is CQ-35. Section 5.6 lists them.
- **Licences (addition to 9.3):** The app ships no model files. The shipped workflows name models the user downloads. The app says where each model's licence can be read, and says plainly when a licence limits commercial use; holding the licence is the user's responsibility (FR-285). What was read: the stills model is under Apache 2.0 (V-24); the video model's free licence does not cover commercial use in several regions (V-25); "Krea 2"'s free licence allows commercial use only below $1,000,000 a year in company revenue (V-31); the video enlarger SeedVR2 is under Apache 2.0 (V-41); the cut-out model BiRefNet is under the MIT licence (V-43).
- **Tests:**
  - The normal test run never contacts a ComfyUI server.
  - Developers and the stakeholder try generation features by hand through ComfyUI in place of paid providers (answer 7), on the real screens and on the hand-test screen (FR-290).
  - There are opt-in tests against a ComfyUI server, run on request, kept apart from the normal test run and from the paid live tests.
  - Agents working on the project may run the ComfyUI tests without asking each time (answer 22: "Yes"). This is for ComfyUI tests only. For paid live tests the standing rule stays as it is: never without the stakeholder's say-so (D-049).
  - The test server is the stakeholder's 3090 machine, reachable only where that machine can be reached (answer 24). ComfyUI tests can run only from there.
  - The test server's address is in the project's private test settings file `.env.local`, under the name `COMFY_BASE_URL`. Confirmed (D-053 item 13: "Yes"). Only the file name and the setting's name are recorded here. The address is never committed to the repository, never printed, and never written into a test report. Agents do not open the private settings file (D-044).
  - Every ComfyUI test follows FR-289.
  - Limit to state plainly: ComfyUI tests prove everything after the provider boundary (jobs, storage, results, the editor). They do not prove that the Gemini, fal or OpenAI connections work.

---

## 4. Out of scope

Decided by the stakeholder's answers:

- Loading the user's own workflow files (answer 1: "Shipped workflows only for now").
- ComfyUI servers that need a sign-in, a password or a key, including the hosted Comfy Cloud service and servers behind a sign-in page (answer 4: "Plain only for now").
- More than one saved ComfyUI address, or spreading runs across several servers (answer 12: "One").
- Checking whether the user holds a model licence, or blocking a run because of one (answer 16).
- A spending cap for agent-started runs on a paid provider (D-053 item 8: "No spending cap necessary").
- Encrypted ComfyUI servers whose certificate the user's computer does not trust (D-053 item 16).

Still proposals. The stakeholder can move any of them in:

- Installing, starting, stopping or updating ComfyUI.
- Downloading or installing models or add-ons on the server. The app only names what is missing (FR-263, FR-266).
- Building or editing a workflow inside the app.
- ComfyUI's own paid "partner" steps, which call outside paid models from inside a workflow. This includes the paid hosted versions of the named video model and its paid "2K" step (V-26, V-42). The shipped workflows use only models that run on the server itself.
- Finding ComfyUI servers on the network automatically. The user types the address.
- ComfyUI for the app's text jobs: reading briefs, layout proposals, copy options, translation.
- Removing uploaded reference pictures from the server's folders (FR-271).

No longer out of scope:

- An external agent starting ComfyUI runs (FR-279, FR-280).
- An external agent starting runs on a paid provider that supports cancelling (FR-279, answer 20), within FR-292.
- Sound. A generated video keeps its sound (FR-283, D-053 item 12).

---

## 5. Facts: verified and not verified

Checked on 2026-11-20 against public documentation and public source only. No ComfyUI server was contacted. "Verified" means read on the named page that day. It does not mean tried. Facts marked "third party" were read on a page that is not the maker's own. Facts marked "search summary" were read in a search result and the page itself was not opened. V-40 to V-45 and U-29 to U-32 are new in draft 4.

### 5.1 Verified: ComfyUI

| # | Fact | Where read |
|---|------|------------|
| V-1 | A run is submitted by sending the workflow to the server, which checks it and puts it in a queue. The answer gives an ID for the run and its place in the queue. If the check fails, the answer is an error with a list of the faulty steps. | docs.comfy.org, "Routes" page (`/prompt`); `server.py` |
| V-2 | A result can be fetched in two steps: ask the server's history for that run's ID to learn the names of the files it made, then fetch each file by name. | ComfyUI repository, `script_examples/websockets_api_example.py`; "Routes" page (`/history/{prompt_id}`, `/view`) |
| V-3 | A workflow is a file that describes the steps to run and how they connect. There are two forms. The normal saved form holds the picture of the canvas and is for opening in ComfyUI's screen. The "API" form, made with "Export (API)" in ComfyUI's menu, lists each step by ID with its type and its values. The official example submits the API form. | Example script above; docs.comfy.org batch generation tutorial; Comfy-Org/workflows repository README |
| V-4 | The server reports live over a second, always-open connection: queue length, run started, which step is running, progress within a step, run finished, run failed, run interrupted. | docs.comfy.org, "Messages" page |
| V-5 | The server can be asked to stop a run, and the request can name one run's ID. Waiting runs can be removed from the queue by ID. Newer servers also have "jobs" requests that list jobs and cancel one by ID. | `server.py` (`/interrupt`, `/queue`, `/api/jobs`) |
| V-6 | A reference picture is uploaded to the server as a file. The server saves it in its input folder and answers with the name it was saved under; the workflow then refers to it by that name. The default upload limit is 100 MB. | `server.py` (`/upload/image`); `comfy/cli_args.py` (`--max-upload-size`) |
| V-7 | A server can be asked which kinds of model folder it has, which model files are in each, and which step types it supports with the values each accepts. | "Routes" page and `server.py` (`/models`, `/models/{folder}`, `/object_info`) |
| V-8 | By default a server listens only on its own computer, at port 8188, with an unencrypted connection. Its owner must start it with an extra option to be reachable from the network, and with two more options to encrypt the connection. | `comfy/cli_args.py` (`--listen`, `--port`, `--tls-keyfile`, `--tls-certfile`) |
| V-9 | A plain ComfyUI server has no password, key or sign-in option. The server does refuse some requests that come from a web page on a different site. | `comfy/cli_args.py`; example script; `server.py` (origin check) |
| V-10 | Models are named inside a workflow by file name. The files live in named folders under the server's `models` folder. | Example script; ComfyUI `README.md` |
| V-13 | The hosted Comfy Cloud service needs a paid plan and a key sent with each request. | docs.comfy.org, Cloud API overview |
| V-14 | ComfyUI can run paid "partner" steps that call outside models. They are optional and can be switched off on the server. | ComfyUI `README.md`; `comfy/cli_args.py` |
| V-15 | ComfyUI's repository has an example whose first lines say it "uses the websockets api and the SaveImageWebsocket node to get images directly without them being saved to disk". The picture's bytes arrive over the live connection of V-4. | ComfyUI repository, `script_examples/websockets_api_example_ws_images.py` |
| V-16 | ComfyUI's preview step for pictures "saves it to a temporary directory" under "a unique temporary file name". The page names no output folder. It does not say when the temporary file is removed. | docs.comfy.org, built-in nodes, "PreviewImage" |
| V-38 | ComfyUI's built-in video save step "saves the input video to your ComfyUI output directory". Its settings are a file name prefix (default `video/ComfyUI`), a container format and a codec. The page shows no setting that writes to a temporary folder or that skips saving. | docs.comfy.org, built-in nodes, "SaveVideo" |
| V-39 | A ComfyUI server has a temporary folder. Its owner can set where it is with a start-up option (`--temp-directory`). The server's start-up code calls a step named `cleanup_temp_filesystem` when the server starts, unless a feature called the asset manager is switched on. No such call was seen at shutdown. The body of that step was not read. | ComfyUI repository, `main.py` |
| V-41 | Video enlarging is built in. "SeedVR2 is natively supported in ComfyUI (PR #14424)". The page has a "SeedVR2 3B Int8: Upscale Video" workflow. Two model sizes, 3B ("lower VRAM requirements") and 7B (higher quality "at the cost of increased VRAM and processing time"), in `diffusion_models`, with `seedvr2_ema_vae_fp16.safetensors` in `vae`. "Both are available under the Apache 2.0 license." No ComfyUI version number and no memory figure is given. The page does not say whether sound is kept. | docs.comfy.org, tutorials, utility, "seedvr2" |
| V-43 | Cut-out is built in. "BiRefNet is natively supported in ComfyUI (PR #12747)". A ready workflow "BiRefNet: Remove Background" gives "the result with a transparent background (RGBA)" and "the extracted foreground mask". Model file `birefnet.safetensors` in `models/background_removal/`. "The model weights are available under the MIT License". No ComfyUI version number is given. | docs.comfy.org, tutorials, utility, "remove-background-birefnet" |

V-11 and V-12 of draft 1 (lists of other models) are dropped. The models are now named.

### 5.2 Verified: the named models

**"Minimax H3" (public name: MiniMax H3)**

| # | Fact | Where read |
|---|------|------------|
| V-17 | It runs on the user's own hardware inside ComfyUI. ComfyUI's page says its "open weights let you run the model locally". ComfyUI's blog (dated 2026-08-03) calls it "natively supported". The basic workflows need ComfyUI 0.30.0 or later. The files are in the `Comfy-Org/MiniMax-H3` store on Hugging Face. The workflows that start from a picture or text use `minimax_h3_fl2va_pruned_int8_convrot.safetensors`; the reference workflow uses `minimax_h3_ref2va_pruned_int8_convrot.safetensors` (both in `diffusion_models`). All use `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` (`text_encoders`), `minimax_h3_video_vae_int8_convrot.safetensors` and `minimax_h3_audio_vae_fp32.safetensors` (`vae`). | docs.comfy.org, MiniMax H3 tutorial and "native" page; blog.comfy.org, "MiniMax H3 Day-0 Support in ComfyUI" |
| V-18 | It takes pictures. There are three shipped example workflows: text to video, picture to video (with an optional last frame), and reference to video. The reference workflow takes "up to 9 images, 3 videos, and 3 standalone audio clips". A first-frame picture of a different ratio is stretched to fit. | docs.comfy.org, "native" page |
| V-19 | On local hardware it targets about 1 megapixel (768 pixels on the short side) at 24 frames a second, for clips up to about 15 seconds. Sides should be multiples of 32. The 2K size is for the hosted service; locally it needs a separate enlarging pass. | docs.comfy.org, MiniMax H3 tutorial and "native" page; blog |
| V-20 | It makes sound with the picture, in one file: "native stereo audio (voice, SFX, and music in a single pass)". | docs.comfy.org, MiniMax H3 tutorial |
| V-25 | Licence: the Hugging Face store lists "minimax-h3-community-license-agreement". ComfyUI's tutorial says: "Commercial use of locally generated outputs requires a MiniMax commercial license, available through Comfy, the only official reseller." Comfy's licence page says the community licence generally allows commercial use up to $20M a year in revenue, that "The US, EU, UK, and South Korea are excluded" from it, and that the paid "Professional" licence is from $5,000 a month for up to 10 users. It says the paid licence covers client work. It does not mention advertising by name. | huggingface.co/Comfy-Org/MiniMax-H3; docs.comfy.org, MiniMax H3 tutorial; comfy.org/minimax/license |
| V-26 | There are also paid hosted versions reached through ComfyUI's partner steps: "MiniMax H3", "MiniMax H3 Max" and "MiniMax H3 Max Turbo", billed per second of video to a Comfy account. These do not run on the user's hardware. | docs.comfy.org, partner nodes, MiniMax H3 |
| V-27 | Memory: the blog says it "can run locally" on an RTX 3060 using "dynamic VRAM offloading", and that memory use drops from 123.6 GB at full precision to 42.5 GB for the smallest version. No figure for a 24 GB card is given. | blog.comfy.org |
| V-42 | The "native" page names two of the model's own steps, `MiniMaxH3ImageToVideo` and `MiniMaxH3AddGuide`, and lists model files but no add-on packs. It says the advanced features need "a recent ComfyUI build". It does not name the step that saves the video with its sound, and says nothing about enlarging. Search summary only: the model's "2K" step is one of the paid hosted steps; and community workflows for this model exist that depend on add-on packs (named there: KJNodes, rgthree, VideoHelperSuite). | docs.comfy.org, MiniMax H3 "native" page; search summary |

**"Moss Image" (public name: MOSS-Image, from OpenMOSS)**

| # | Fact | Where read |
|---|------|------------|
| V-21 | It runs on the user's own hardware inside ComfyUI. ComfyUI's page says the weights run with "no API key and no per-image credits". The text-to-picture workflows need ComfyUI 0.42.0; the "Image Edit" and "Color & Depth Control" workflows need 0.43.0. Files are in the `Comfy-Org/MOSS-Image` store on Hugging Face: `moss_image_sft_int8_convrot.safetensors` or `moss_image_base_int8_convrot.safetensors` (`diffusion_models`), `qwen3.5_9b_w4a8_gptq.safetensors` (`text_encoders`), `flux2-vae_small.safetensors` (`vae`), and for editing `moss_image_edit_lora_rank_64_bf16.safetensors` (`loras`). There are two versions, "Base" and "SFT". | docs.comfy.org, MOSS-Image tutorial |
| V-22 | Sizes: width and height must be multiples of 16. Recommended 1 to 2 megapixels; it "extrapolates from about 0.25 MP to 4 MP". Any ratio can be chosen. | Same page |
| V-23 | Reference pictures: the page says "MOSS-Image has no image input, so it cannot copy a reference". The optional picture input on the text-to-picture workflow feeds only the step that rewrites the prompt. The separate "Image Edit" workflow takes a source photo and an instruction, and "Connect up to four references". It scales the input to 1 megapixel and keeps its ratio. | Same page |
| V-24 | Licence: "Apache 2.0". The page makes no separate statement about commercial use. A third-party guide says the licence allows commercial use. Released 2026-10-16 per a third-party page. | docs.comfy.org; comfyui-wiki.com; comfyui.nomadoor.net |
| V-28 | File sizes from a third-party guide: main model 5.41 GB, text model 9.75 GB, picture decoder 336 MB. The same guide recommends a 3090-class card when renting one. No official memory figure was found. | comfyui.nomadoor.net (third party) |

**"Krea2" (public name: Krea 2, from Krea AI)**

| # | Fact | Where read |
|---|------|------------|
| V-29 | It runs on the user's own hardware inside ComfyUI. Krea's own page describes two sets of open weights: "Krea 2 RAW is the base model" and "Krea 2 Turbo is an 8-step distilled checkpoint built for fast, high-quality text-to-image". ComfyUI's blog (dated 2026-06-23) says the files "load through the standard diffusion model nodes" and says "Update ComfyUI to the latest version 0.26.0". ComfyUI's tutorial names the files: `krea2_turbo_fp8_scaled.safetensors` ("recommended for most users") or `krea2_turbo_int8_convrot.safetensors` (`diffusion_models`), `qwen3vl_4b_fp8_scaled.safetensors` (`text_encoders`), `qwen_image_vae.safetensors` (`vae`), and for the style workflow `krea2_style_reference.safetensors` (`loras`). The tutorial gives no version number and does not say whether an add-on is needed. It lists only Turbo files for ComfyUI, none for Raw. | github.com/krea-ai/krea-2 `README.md`; blog.comfy.org, "Krea 2 Open-Source Models are now available in ComfyUI"; docs.comfy.org, Krea 2 tutorial |
| V-30 | ComfyUI's tutorial shows two workflows: "Text to Image" and "Image Style Reference". The second takes one or two uploaded pictures "to influence the aesthetic style, mood, and visual direction of the generated output". The page says nothing about keeping a subject or product from a reference, about editing a picture, or about extending one. Krea's own page describes only making a picture from a prompt. | docs.comfy.org, Krea 2 tutorial; krea-ai/krea-2 `README.md` |
| V-31 | Licence: the "Krea AI Community License". Its text says commercial use of the model, of things derived from it, or of its outputs "is permitted only if" the user has "total company-wide annual revenue of less than one million United States dollars ($1,000,000 USD)", counted across related companies. At or above that, the user "must obtain a separate enterprise license from Krea prior to any Commercial Use". No price is given; the page gives a contact address. The grant is "worldwide". No country is excluded by name. The user "must implement reasonable and appropriate Content Filter measures". The user owns the outputs, "subject to your compliance with this Agreement". | krea.ai/krea-2-licensing |
| V-32 | Sizes: Raw "has been trained to generate upto 1k resolution". Turbo "can generate images from 1k ~ 2k resolution". Width and height are padded up to a multiple of 16. ComfyUI's tutorial says "Krea 2 supports outputs from 1K to 2K". | krea-ai/krea-2 `README.md`; docs.comfy.org, Krea 2 tutorial |
| V-33 | Third party: a community author has published a "Krea 2 inpaint edit" add-on for ComfyUI. It has an "Outpaint" workflow that places the picture on a larger canvas and fills the border. It needs an add-on pack on the server (the page names "ComfyUI-Krea2-Ostris-Edit") and extra files in `loras`. It is not from Krea and not from ComfyUI. The page gives no licence, no ComfyUI version and no memory figure for it. | comfyui-wiki.com, news item dated 2026-09-24 (third party) |

### 5.3 Verified: the paid providers (cancelling, usage, video)

| # | Fact | Where read |
|---|------|------------|
| V-34 | fal, cancelling. A request in fal's queue can be cancelled by its ID with the user's key. For a waiting request: "The request is removed immediately and is never processed." For a running request: "fal sends a cancellation signal to the runner. The request may still complete if the app does not handle cancellation." The answers are: removed; stop asked for; already finished; not found. The page does not say whether a cancelled request is charged. | fal.ai/docs, "Queue" page (model APIs) |
| V-35 | Google, cancelling. Google documents a cancel request only for work started in "background" mode of its Interactions API: it "Stops the running task" and "The status transitions to `cancelled`". The page lists standard Gemini models and "Managed Agents" for that mode and does not mention picture models. No cancel request for an ordinary started picture request was found. The page does not say whether cancelled work is charged. | aistudio.google.com/docs, "Background execution" (reached from ai.google.dev) |
| V-36 | fal, usage. fal has a usage request that returns records for the account: quantity, unit price, discount and total cost, with a currency, which can be narrowed by endpoint, key, date range and more. The page says the key must be "on the `BILLING` preset, or any key whose permissions include the ones this API lists" (`billing:usage:read`, `auth:keys:read`, `account:users:read`), and names the key kinds `BILLING` and `FULL`. It lists "Access denied" as a possible answer. It gives no figure for how late the data is. Read again for draft 4, unchanged. | fal.ai/docs, platform APIs, "models/usage" |
| V-37 | Google, usage. Google's billing page says "You can monitor your usage of the Gemini API in Google AI Studio", and that costs also show in the Cloud Billing pages. It describes no request that reads usage or spend with a Gemini API key. It says "Billing data processing times can be delayed in AI Studio, up to around 10 minutes", and that cost graphs "can take up to 24 hours to update". It says requests that fail with a 400 or 500 error are not charged for tokens. It says nothing about cancelled requests. It says a user with the right role can set a monthly spend cap per project in AI Studio. Read again for draft 4: keys "have no independent billing settings". | aistudio.google.com/docs, "Billing" (reached from ai.google.dev) |
| V-40 | fal, video. Search summary: fal lists its video model "Seedance 2.0" as three kinds of request: text to video, picture to video (a first picture and an optional last picture), and reference to video (pictures, videos and audio clips as references, up to 9 pictures). fal's page advertises sound made with the picture. The name of the setting for sound was not confirmed. | fal.ai model pages for `bytedance/seedance-2.0` (search summary) |

More on usage, on OpenAI, and on cut-out through fal is in `REQUIREMENTS-D053.md`, Sections 4 and 5.

### 5.4 What the brief asked about each model, in one place

| Question | "Minimax H3" | "Moss Image" | "Krea2" |
|----------|--------------|--------------|---------|
| Found under the given name? | Yes, as "MiniMax H3". | Yes, as "MOSS-Image". | Yes, as "Krea 2" (Raw and Turbo). |
| Runs in ComfyUI on the user's own hardware? | Yes (V-17). Paid hosted versions also exist and are a different thing (V-26). | Yes (V-21). | Yes (V-29). A paid hosted version reached through ComfyUI's partner steps also appears to exist; its page was not read. |
| Plain install, no add-on? | Described as supported by ComfyUI itself. Not stated in so many words (U-12). | Same (U-12). | For a picture from a prompt and for style reference: the blog says the files load through standard steps (V-29); not stated in so many words (U-12). For extending a picture: an add-on is needed, by the only way found (V-33). |
| Fits a 24 GB card? | Not verified. No 24 GB figure (V-27). The stakeholder reports it is installed on the 3090 machine. | Not verified. The files add up to about 15.5 GB by a third-party count (V-28). | Not verified. No official figure. Third-party pages say the smaller Turbo files run on 16 GB cards and that Raw needs at least 24 GB (U-21). |
| Takes reference pictures? | Yes, up to 9 (V-18). | Not the model on its own. The edit workflow takes up to four (V-23). | For style only: one or two pictures that steer look and mood (V-30). Nothing found from Krea or ComfyUI on keeping a product recognisable (U-23). |
| Extends a picture to a new ratio? | Not a stills model. Nothing found. | Nothing found in public documents (U-13). The stakeholder says it can. | Not with Krea's or ComfyUI's own parts (V-30). A community add-on does it, read on a third-party page only (V-33, U-22). |
| Licence for commercial ad use? | Limited. Free licence does not cover the US, EU, UK or South Korea; paid licence from $5,000 a month (V-25). | Apache 2.0 (V-24). Licence text itself not read. | Limited. Free licence allows commercial use only below $1,000,000 a year in company revenue; above that a paid licence, price not published; content filtering required (V-31). |

### 5.5 Not verified

| # | Point | Why it matters |
|---|-------|----------------|
| U-1 | That a missing model is always caught by the server's check at submit time (V-1) with a message that names the file. | FR-266. FR-263 gives a second, verified way. |
| U-2 | The exact shape of a finished run's history entry, and how a video file is listed in it compared with a picture. | FR-262. |
| U-3 | That stopping one named run never disturbs another person's run on a shared server. | FR-270, FR-271, FR-289. |
| U-4 | Whether the server offers a way to delete an uploaded input file or a saved output file by request. None was seen. | FR-271, FR-289, FR-291. |
| U-7 | What the newer "v2" interface is and whether a plain local server has it. | For the architect. |
| U-8 | Which ComfyUI version is current. Versions 0.26.0, 0.30.0, 0.42.0 and 0.43.0 were read as minimums (V-17, V-21, V-29). The pages for the video enlarger and for cut-out give no number and say "latest" or "Nightly" (V-41, V-43). Which version the test machine runs is not known. | Compatibility; FR-263. |
| U-11 | Whether each named model, with all its parts loaded, runs on one 24 GB card at the sizes and clip lengths this app needs, and how long a run takes. | FR-284, Performance. Needs a trial on the test machine. |
| U-12 | That the shipped example workflows for the models need no add-on. They are called native, core or standard. No page says "no custom nodes". | FR-263, Section 5.6. |
| U-13 | Any way to extend a picture to a new ratio with "Moss Image". The model's page does not mention it. The stakeholder says it can be done (answer 18). Whether the edit workflow does it when asked in words is not known. | FR-261. Needs a trial. |
| U-14 | Closed in draft 4. Sound is kept (FR-283), so it no longer matters whether the model can be told to make none. | |
| U-15 | Any built-in way to get a video back from ComfyUI without a file being saved on the server. The built-in save step always saves (V-38). No example like V-15 was found for video. | FR-282, FR-291. |
| U-16 | What a ComfyUI server keeps about a finished run in its own history (for example the prompt), and for how long. | FR-271, Privacy. |
| U-17 | Whether a "Moss Image" workflow that takes reference pictures keeps a product recognisable well enough for ads. The stakeholder reports results that "look quite good". | FR-260. Needs a trial. |
| U-18 | The full text of the MiniMax and MOSS-Image licences. The MiniMax licence file did not load from Hugging Face. What is in V-25 comes from ComfyUI's pages about it. The Apache 2.0 label for MOSS-Image was read on ComfyUI's page, not on the model's own licence file. The Krea licence was read on Krea's page, in summary, not line by line. | Licences, FR-285. |
| U-19 | Whether the exact ratios this app needs can be made by the video model. Its sides must be multiples of 32 near 1 megapixel, and its own "16:9" example is 1344×768, which is close to but not exactly 16:9. The stakeholder accepts 768×1344 (D-053 item 15). | FR-262, A-C3. |
| U-20 | Whether one run of the video model can take a first frame and reference pictures together. The public page shows them as separate workflows that use different model files (V-17, V-18, V-42). | FR-286. |
| U-21 | Whether "Krea 2" fits one 24 GB card. No official figure. A third-party article says a smaller build of the main file is about 12 GB and fits a 16 GB card. Another third-party page says Raw needs at least 24 GB with memory management. Neither page was opened; both are from search summaries. | FR-288. |
| U-22 | Whether "Krea 2" can extend a picture to a new ratio on a plain ComfyUI server with no add-on, and how good the community way (V-33) is. | FR-261, CQ-35, CQ-36. |
| U-23 | Whether "Krea 2" can keep a product recognisable from reference pictures. Only style reference is documented (V-30). | FR-288, CQ-36. |
| U-24 | Whether a started Gemini picture request can be cancelled on Google's side. No documented way was found for an ordinary request (V-35). Whether Google's picture models work in "background" mode, where cancel exists, is not stated. | FR-279, FR-281, CQ-34. |
| U-25 | Whether the video model the app uses on fal really stops when a running request is cancelled, and whether fal or Google charge for a cancelled request. | FR-281. |
| U-26 | Whether an ordinary fal key, the kind used to generate, can read usage. The usage page names only keys with billing rights (V-36). | FR-304 in `REQUIREMENTS-D053.md`. |
| U-27 | Any way to read Gemini usage or spend with a Gemini API key. None is described on Google's billing page (V-37). | FR-304 in `REQUIREMENTS-D053.md`. |
| U-28 | A way to write a video to ComfyUI's temporary folder with built-in parts. Only community add-ons were seen, on third-party pages. Also not verified: exactly what the start-up clearing step removes (V-39). | FR-291. |
| U-29 | For the built-in video enlarger (V-41): whether it fits one 24 GB card in the same run as the video model; how long it takes; whether it passes the clip's sound through; which ComfyUI version first has it. | FR-293. Needs a trial. |
| U-30 | Which built-in steps join picture and sound into one video file and save it. The model's page says the result is one file with sound (V-20) but does not name the steps (V-42). The analyst believes ComfyUI's own "create video" and "save video" steps take sound, from earlier reading; this was not read on a page for this draft. | FR-283, Section 5.6. |
| U-31 | The licences of the community add-on packs named in Section 5.6, where the table says "not read". | CQ-35. |
| U-32 | Whether a started OpenAI picture request can be cancelled. Not checked. | FR-279, FR-281; FR-306 in `REQUIREMENTS-D053.md`. |

U-5, U-6, U-9 and U-10 of draft 1 are closed or no longer apply: the models are named, plain servers only, shipped workflows only.

### 5.6 Add-ons: what each planned job needs outside ComfyUI's own parts

The stakeholder asked (D-053 item 9): "What community add-ons are you thinking of?"

Short answer: for the first build, none, as far as the public pages say. One planned job needs one. The others in the second table are add-ons that community workflows often use for the same jobs. They are listed so the stakeholder knows the names. The analyst does not propose requiring them.

**Per job**

| Job | Built into ComfyUI? | Add-on needed? | Checked? |
|-----|---------------------|----------------|----------|
| Video with "Minimax H3" (prompt, first frame, reference pictures) | Yes. "Natively supported" (V-17, V-42). | None known. | Not stated in so many words (U-12). |
| Saving the video with its sound | Yes, by ComfyUI's own save step (V-38). | None known. | The step that joins sound and picture was not read on a page (U-30). |
| Stills with "Moss Image" (prompt; edit with reference pictures) | Yes (V-21). | None known. | Not stated in so many words (U-12). |
| Extend a background with "Moss Image" | Not known. No documented way found (U-13). | Not known. | Needs a trial. |
| "Krea 2": picture from a prompt, style reference | Yes. Files "load through the standard diffusion model nodes" (V-29). | None known. | Not stated in so many words (U-12). |
| "Krea 2": extend a background | No (V-30). | **Yes: "ComfyUI-Krea2-Ostris-Edit"**, from a community author (V-33). | Third-party page only. Licence not stated (U-31). |
| Optional video enlarging | Yes. SeedVR2, "natively supported", Apache 2.0 (V-41). | None known. | Fit on 24 GB and sound not verified (U-29). |
| Cut-out (FR-307 in `REQUIREMENTS-D053.md`) | Yes. BiRefNet, "natively supported", MIT (V-43). | None. | Read on ComfyUI's own page. |
| A video file kept only for a short time (FR-291) | No built-in way found (V-38). | Only add-ons were seen (U-28). | Third-party pages only. |

**Community add-ons that could come up, and what each is for**

| Add-on pack | What it is for | Needed by the plan? | Licence | Checked? |
|-------------|----------------|---------------------|---------|----------|
| ComfyUI-Krea2-Ostris-Edit | Extending and editing a picture with "Krea 2". | Only if "Krea 2" is used to extend a background. | Not stated on the page read. | Third party (V-33). |
| ComfyUI-VideoHelperSuite | Loading and saving video, joining video and sound, video previews. Many community video workflows use it. | No, if the built-in save step does the job (U-30). A fallback if it does not, and one possible route to a temporary video file (FR-291). | Not read (U-31). | Named in a search summary (V-42). |
| ComfyUI-KJNodes | A large set of helper steps (resizing, masks, memory handling). Community video workflows often use it. | No. | Not read (U-31). | Named in a search summary (V-42). |
| rgthree-comfy | Helper steps that tidy large workflows. | No. | Not read (U-31). | Named in a search summary (V-42). |
| ComfyUI-SeedVR2_VideoUpscaler | The community form of the SeedVR2 video enlarger. | No. The built-in form exists (V-41). | Repository says MIT for its code; the model is Apache 2.0. | Search summary. |
| ComfyUI-RMBG | Many cut-out models in one pack. | No. The built-in cut-out exists (V-43). | GPL-3.0 for the pack. Some models in it limit commercial use. | Repository page read. |

Why this matters: an add-on is code from a community author that runs on the user's server. Each one the app requires is one more thing the user must install, keep up to date and trust, and one more thing that can break when ComfyUI changes. The test server may also be a production server (FR-289). See CQ-35.

### 5.7 Cut-out in ComfyUI

For FR-307 in `REQUIREMENTS-D053.md`. ComfyUI has cut-out built in (V-43): a picture goes in, and a picture with a transparent background and a mask come out. The model is under the MIT licence. So a shipped cut-out workflow would need one more model file on the server and no add-on. It would follow every rule in this file: shipped workflow only (FR-278), the needs list (FR-263), the result stored as PNG (FR-264).

---

## 6. Questions for the stakeholder

### 6.1 Answered

Answers are word for word.

**Rounds 1 and 2 (CQ-1 to CQ-26), answered on 2026-11-20**

| # | Question | Answer | Date |
|---|----------|--------|------|
| CQ-1 | Do workflows ship with the app only, or can the user also load their own? | "Shipped workflows only for now, we should plan on Minimax H3 for video with images references and Moss Image for stills" | 2026-11-20 |
| CQ-2 | Which models do the shipped workflows assume, and what hardware does the test machine have? | "My test machine does have Minimax but not moss installed. GPU is a 3090. We can finish installation on that end later but will wanna get everything built out for this to run in the meantime" | 2026-11-20 |
| CQ-3 | Pictures only, or video too? | "Both" | 2026-11-20 |
| CQ-4 | Do ComfyUI servers with a password, or behind a hosted service, count? | "Plain only for now" | 2026-11-20 |
| CQ-5 | May an external agent start ComfyUI runs? | "Outside agent should be able to start any runs which have a setting ticked in settings, is my new thinking. I would like an agent to be able to do those runs overnight since they're running for free on my own hardware" | 2026-11-20 |
| CQ-6 | An unencrypted connection to a server on another computer: allow, warn or refuse? | "Allow plain http to another computer" | 2026-11-20 |
| CQ-7 | What should "cheaper testing" mean for the project's own test process? | "We can run more testing without burning credits against comfy" | 2026-11-20 |
| CQ-8 | Should ComfyUI also do "generate fill"? | "Yes extend background included" | 2026-11-20 |
| CQ-9 | May the app show the ComfyUI server's own error text? | "Yes" | 2026-11-20 |
| CQ-10 | Cancelling: for ComfyUI only, or for every provider? | "We can add for every provider that allows it" | 2026-11-20 |
| CQ-11 | Should the app tidy up what it leaves on the server? | "If you use image previews you should be able to get bytes back without outpu" (the message was cut off) | 2026-11-20 |
| CQ-12 | One ComfyUI address, or several? | "One" | 2026-11-20 |
| CQ-13 | Priority and place in the build order: mostly P0, built right after the first picture is made inside the app and before fal video? | "Yes" | 2026-11-20 |
| CQ-14 | Should ComfyUI runs be counted in the campaign's generation total? | "No don't count local providers/models towards usage" | 2026-11-20 |
| CQ-16 | The video model's licence limits commercial use. What should the app do about it? | "That's fine we can leave it to the user to know they've obtained a Minimax license." | 2026-11-20 |
| CQ-17 | Stills with reference pictures: is the "Image Edit" workflow of "Moss Image" the answer? | "If Moss ends up being a dead end for reference images we can try something else, but the results I've seen look quite good, so we should try one of the image reference workflows" | 2026-11-20 |
| CQ-18 | Extend a background: with which model? | "Extend an image can be done with MOSS or with Krea2, which is another interesting one to support" | 2026-11-20 |
| CQ-19 | What does a ComfyUI video start from? | "Comfy video can start from first frame or no starting frame, with or without references. User might be prompting for something abstract or a plain background and that's fine" | 2026-11-20 |
| CQ-20 | The agent tick: which providers, and what limits? | "The tick should exist for any providers which support cancelling, I'm not sure if gemini is included in that but if so we should support cancellation there too" (answers "which providers" only; the limits were answered in D-053 item 8) | 2026-11-20 |
| CQ-21 | What does a cancelled paid run cost the user, and how is it counted? | "We should be able to get usage accurately via the provider API key" | 2026-11-20 |
| CQ-22 | May agents working on the project run the ComfyUI tests without asking each time? | "Yes" | 2026-11-20 |
| CQ-23 | Does the hand-test screen (D-048) get a ComfyUI part? | "Sure, Comfy is a priority so we can repetitively test the system without incurring costs" | 2026-11-20 |
| CQ-24 | Whose machine runs the ComfyUI test server, and can other testers reach it? | "Correct my 3090 machine is our comfy test server, I will likely use it in production as well" | 2026-11-20 |
| CQ-25 | Is ComfyUI video built before fal video? | "They are both equally important" | 2026-11-20 |
| CQ-26 | Is the reading of answer 11 right? Is a saved video file on the server acceptable? | "If it is required that's fine for this first run, but we should look into how we can temporarily save a video file on the host machine so we don't eat up host storage" | 2026-11-20 |

Also told to the project on 2026-11-20: the test server's address is in the project's private test settings under the name `COMFY_BASE_URL`. Only the name is recorded.

**Round 3 (D-053), answered on 2026-11-20**

"Item" is the number in D-053. Only the items that touch this file are listed. All 30 are in `REQUIREMENTS-D053.md`, Section 1.

| Item | Question it answers | Answer | Applied in |
|------|---------------------|--------|------------|
| 4 | OI-50: a ComfyUI address that is refused | "It should just refuse a malformed URL (validation fails)" | FR-251 |
| 7 | CQ-15, OI-34: which models | "I believe it's the local H3 model. MOSS is not yet installed" | Section 1, FR-258, FR-284 |
| 8 | CQ-20, OI-35: agent run limits | "4 is a fine default, this can be configurable. No spending cap necessary. Unticking shouldn't affect active jobs. If fal charges you either way then just let it finish." | FR-292, FR-279, FR-280, FR-281 |
| 9 | CQ-27, OI-39: Krea 2 | "Krea 2 can provide alternate workflows. What community add-ons are you thinking of?" | FR-288, FR-261, Section 5.6 |
| 10 | CQ-28, OI-40: usage | "That's surprising to me. I wonder if there is a better fit then as usage seems like it would be an important figure for a business like our client's. Does GPT offer this insight? I am interested in offering GPT 2.5 as a provider for image gen by the way." | FR-287 replaced; `REQUIREMENTS-D053.md` |
| 11 | CQ-29, OI-41: fal video start options | "Yes fal should offer the same options whatever available." | FR-286 |
| 12 | OI-36: video sound | "Why not keep sound? For fal as well. Although the user should be able to drop audio in as well for video variants, or use the audio that came with the video (gen or premade)." | FR-283; `REQUIREMENTS-D053.md` |
| 13 | OI-37: is `COMFY_BASE_URL` in `.env.local` | "Yes" | Section 3.3, Tests |
| 14 | OI-38: workflow files | "Dispatch an agent to construct workflows for me to test" | Section 9, L-7 |
| 15 | The video model's result size of 768×1344 | "It will have to be acceptable, maybe we should add an optional video upscaler to the workflow as well." | FR-262, FR-293 |
| 16 | OI-42: self-signed certificates refused | "Ok" | FR-276 |
| 17 | ComfyUI video before fal video | "Yes" | Section 9, L-1 |
| 21 | Every generated picture stored as PNG | "Correct" | FR-264 |

How the answers were read:

- CQ-7 is read as: hand-testing through ComfyUI, and opt-in tests against a named server.
- CQ-9 "Yes" is read as the recommended form: plain message first, the server's own words on request.
- CQ-11 is read as "without output files" (A-C7). Answer 26 did not correct that reading, and it is kept.
- CQ-13 "Yes" is read with answers 3 and 8 on top: FR-261 and FR-262 are P0.
- CQ-16 is read as a rule for any model with such a licence, not only the video model (FR-285).
- CQ-17 is read as: use a "Moss Image" workflow that takes reference pictures; a trial decides; if it fails, another model is chosen later with the stakeholder.
- CQ-18 is read as two things: extend-a-background may use either model, and "Krea2" is wanted as a supported model in its own right.
- CQ-20 is read as: every provider that supports cancelling gets a tick, paid ones included; a provider that does not support cancelling gets none; and where a provider can cancel, the app must offer cancel there (already FR-281).
- CQ-21 was read as a new requirement (FR-287). D-053 item 10 replaced it.
- CQ-22 "Yes" is read as the recommended form: ComfyUI tests only; the rule for paid live tests stays.
- CQ-24 "Correct" is read as: only the stakeholder's machine, reachable only where that machine can be reached.
- CQ-25 with D-053 item 17: both matter equally, and ComfyUI video is built first.
- CQ-26 is read as: a saved video file is acceptable in the first build (FR-282), and a temporary way is to be looked for (FR-291).
- D-053 item 4 is read as: refuse, with no special message for an address found in stored settings (A-C18).
- D-053 item 7 closes CQ-15 for the video model. "I believe" is recorded as given: it is the stakeholder's belief, not a check (A-C11). The choice between "Base" and "SFT" for "Moss Image" was not answered and is left to the architect, as recommended (L-8).
- D-053 item 8: "4" is read as one number for all providers together (A-C21). "Active jobs" is read as waiting and running (A-C20). The fal sentence is read as in FR-281. The answer assumes agents start fal runs, so fal's limited cancel is taken as enough for a tick (A-C14).
- D-053 item 9: "alternate" is read as a second choice beside the main workflow, not a replacement (FR-288).
- D-053 item 11: "whatever available" is read as: each kind of start the provider's service has, and no more (FR-286).
- D-053 item 15: "optional" is read as a step the user turns on for a run, off by default (FR-293).

### 6.2 Open

Each has options and the analyst's recommendation. The requirements are written so that the build can go on while they are open. CQ-30 to CQ-33 are in `REQUIREMENTS-D053.md`, Section 6.

**CQ-34. Agent runs: the parts of CQ-20 not yet answered.**
- Is the limit of 4 one number for all providers together, or 4 for each provider? Recommendation: one number for all together. It is simpler to understand, and it bounds what an agent can have going at once.
- Gemini: no documented way to cancel a started picture request was found (U-24). So, by answer 20, Gemini gets no agent tick. Please confirm. Recommendation: confirm. The architect checks once more before it is fixed (L-4).
- May an agent cancel a run, and only runs it started? Recommendation: yes, and only runs it started.
- May an agent pick one of the options a run produced, or do results always wait for the user? Recommendation: results wait for the user.
- Should FR-268 (pick a run up after a short loss of contact) move to P0, since nobody is watching overnight? Recommendation: yes.
- Whatever the answers: an agent never reads or changes the address or a key (FR-272, FR-198), and only the user can set a tick or the limit, in Settings (FR-279, FR-292).

**CQ-35. Add-ons: which may a shipped workflow require on the server?**
Section 5.6 has the list.
- (a) None. Every shipped workflow uses only ComfyUI's own parts. A job that cannot be done that way is not offered. (b) Allowed one by one, each named by the stakeholder. (c) Allowed whenever the architect finds one useful.
- Recommendation: (a) for the first build, then (b). By the pages read, every planned job has a built-in way except extending a background with "Krea 2". The test server is the stakeholder's own machine and may do production work, so each add-on should be the stakeholder's choice.
- If (b): is "ComfyUI-Krea2-Ostris-Edit" acceptable on the server, should the "Moss Image" trial for extend-a-background fail? Its licence was not found.

**CQ-36. "Krea 2" alternate workflows: which jobs, and which build?**
- Which jobs get a "Krea 2" alternate? (a) A picture from a prompt. (b) Also a picture with a style reference. Note: this copies look and mood, not the product (V-30, U-23). (c) Also extend a background, which needs an add-on (CQ-35).
- Which build? (a) The first ComfyUI build. (b) After the "Moss Image" and video workflows pass on the test machine.
- Recommendation: jobs (a). Build (b). Extend a background with "Krea 2" only if the "Moss Image" trial fails. The first build already has two models not yet proven on the test machine, and "Moss Image" is not installed yet.

Closed in draft 4: CQ-15 (D-053 item 7; the rest left to the architect, L-8). CQ-20 (D-053 item 8; the rest is CQ-34). CQ-27 (D-053 item 9; the rest is CQ-35 and CQ-36). CQ-28 (replaced by CQ-30 in `REQUIREMENTS-D053.md`). CQ-29 (D-053 item 11; the start selected when the dialog opens is left to the design, A-C19).

---

## 7. Assumptions

| # | Assumption | Impact if wrong |
|---|------------|-----------------|
| A-C1 | The user who types the address is entitled to use that server, and trusts whoever runs it with their prompts and reference pictures. | The privacy note in 3.3 would not be enough; a stronger consent step would be needed. |
| A-C2 | The user can install model files on the server themselves, given exact names and folders. | The feature would be unusable for the non-technical creative user in 3.1 of `REQUIREMENTS.md`. It may be a feature for technical users only. |
| A-C3 | The app treats a result of a different pixel size from the one asked for in one common way for all providers. | FR-259 and FR-262 would need their own rule. The named models are sure to return sizes other than the defaults (V-19, V-22). |
| A-C4 | A run on a local provider is not a "paid generation" (FR-230). Decided by answer 14. | None; recorded for FR-230's wording. |
| A-C5 | ComfyUI is an addition. It replaces no provider, and Gemini stays the default for pictures (IR-002). | Defaults in Settings change. |
| A-C6 | The rule "one fixed address per provider" may have this one exception. That is an architect ruling (D-050). | If the architect refuses, the feature as described cannot be built. |
| A-C7 | Answer 11, which was cut off, means "without output files". Answer 26 did not correct it. | FR-282 and FR-271 change. |
| A-C8 | "Overnight" means an agent-started run needs no confirmation from the user at the time (FR-280). | If each run needs the user's yes, FR-280 changes and overnight runs are not possible. |
| A-C9 | The tick is per provider, not per kind of job. | FR-279 would need one tick per provider and job. |
| A-C10 | "Minimax H3", "Moss Image" and "Krea2" are the public models "MiniMax H3", "MOSS-Image" and "Krea 2". | Sections 5.2 and 5.4 describe the wrong models. |
| A-C11 | The video model on the test machine is the local one (V-17), not the paid hosted steps (V-26). The stakeholder believes so (D-053 item 7). It has not been checked on the machine. | The video model would not be running on the stakeholder's own hardware, and would not be free. |
| A-C12 | When a first frame is used for a video, it is the variant's finished background picture (FR-123). | FR-286 would need a way to pick another picture. |
| A-C13 | "With or without references" means the subject's reference files that the generation panel already attaches (FR-062). | FR-286 would need a new way to attach pictures to a video run. |
| A-C14 | "Supports cancelling" is judged per provider by whether the provider offers a request to stop a started run, not by whether stopping always works. So fal has a tick. D-053 item 8 speaks of fal runs in a way that fits this. | fal may lose its tick. |
| A-C15 | Dropped in draft 4 with FR-287. | |
| A-C16 | Leaving the licence to the user (answer 16) is acceptable for every model the shipped workflows name, not only the video model. | FR-285 narrows to the video model, and "Krea2" needs its own answer. |
| A-C17 | The private test settings file `.env.local` holds a working address under `COMFY_BASE_URL` (D-053 item 13). The analyst did not open it. | Opt-in ComfyUI tests cannot run until it is set. |
| A-C18 | "Just refuse" (D-053 item 4) means no special message is needed when an address found in stored settings fails the check. In Settings, an address the user has just typed still gets a plain "not valid" message. | FR-251 would need a message in the first case, or none in the second. |
| A-C19 | When the video dialog opens, the start selected is the variant's finished background as first frame, when there is one. | A design detail changes. |
| A-C20 | "Active jobs" (D-053 item 8) means agent-started runs that are waiting or running. | Unticking would have to cancel waiting runs (FR-279), or FR-292 would count only running ones. |
| A-C21 | The limit of 4 active agent runs is one number for all providers together (CQ-34). | FR-292 becomes a number per provider. |
| A-C22 | The optional video enlarging step is off unless the user turns it on for a run. | FR-293 changes its default. |

---

## 8. Glossary additions

| Term | Definition |
|------|------------|
| ComfyUI | A free program that makes pictures and video with AI models on a computer the user controls. Other programs can drive it over the network. |
| ComfyUI server | A running copy of ComfyUI that the app reaches at an address. |
| Plain server | A ComfyUI server with no sign-in, password or key. The only kind in this build. |
| Test server | The ComfyUI server the project's tests use. It is the stakeholder's own machine and may also do production work (FR-289). |
| Workflow | A recipe a ComfyUI server runs: which models to load, which steps to run and how they connect. |
| Shipped workflow | A workflow that comes with the app. The only kind the app runs in this build. |
| Alternate workflow | A second shipped workflow for the same job, using another model, that the user can choose in place of the main one (FR-288). |
| Model file | A large file holding a trained AI model. The user installs it on the ComfyUI server. A workflow names the model files it needs. |
| Add-on | An extra piece installed into a ComfyUI server that gives it new steps (ComfyUI calls these "custom nodes"). Written by community authors, not by ComfyUI's makers. |
| Built in | Part of ComfyUI itself, with nothing extra to install but the model file (ComfyUI's pages say "native" or "core"). |
| Local provider | A provider that runs on hardware the user controls and sends no bill. Its runs are not counted as usage (FR-257). |
| Agent tick | The setting, one per provider that supports cancelling, that lets external agents start runs for that provider (FR-279). Off until the user ticks it. |
| Active run | A run that is waiting or running (FR-292). |
| Cancelled | The state of a run that was stopped before it finished (FR-281). |
| Start frame (first frame) | The picture a video begins with. A video may have one or none (FR-286). |
| Reference pictures | The subject's reference files (FR-062), given to a model so that what it makes looks like the subject. |
| Extend a background | Make a background picture fit a new ratio by adding new picture around it. The "generate fill" choice of FR-076. |
| Video enlarging | An optional step that makes a finished clip larger in pixels (ComfyUI calls this "upscaling") (FR-293). |
| Hand-test screen | The throwaway screen for trying features by hand (D-048). It has a ComfyUI part (FR-290). |

---

## 9. Left to the architect and the orchestrator

These are not questions for the stakeholder. The stakeholder has said they are for others to settle, or has settled them.

| # | Item | Source |
|---|------|--------|
| L-1 | Settled: ComfyUI video is built before fal video (D-053 item 17: "Yes"). The two stay "equally important": fal video is not dropped or pushed to a later release because of the order. | Answer 25, D-053 item 17 |
| L-2 | Which "Moss Image" workflow is used for stills with reference pictures, and the trial that decides whether it is good enough (FR-260). If it fails, come back to the stakeholder for another model. | Answer 17 |
| L-3 | The trial of extend-a-background on the test machine (FR-261), with "Moss Image" first. | Answer 18, D-053 item 9 |
| L-4 | Checking, per provider, whether a started run can be cancelled and whether a cancelled run is charged, before the ticks are fixed (FR-279, FR-281, U-24, U-25, U-32). | Answer 20, D-053 item 8 |
| L-5 | Finding a way to keep a video file temporary on the server (FR-291), and proposing what "temporary" means. | Answer 26 |
| L-6 | Which test run reads `COMFY_BASE_URL`, kept apart from the paid live tests (Section 3.3, Tests). | Answers 22, 24, D-053 item 13 |
| L-7 | Workflow files: an agent drafts them for the stakeholder to test on the test machine. Each draft must name what it needs on the server (FR-263) and must say plainly when it uses an add-on (CQ-35). | D-053 item 14 |
| L-8 | "Moss Image": "Base" or "SFT", chosen after a trial once the model is installed. | D-053 item 7 |
| L-9 | Making the limit on agent runs (FR-292) agree with the job runner's limit of three per provider. | D-053 item 8 |
| L-10 | The trial of the optional video enlarging step on the 24 GB card, and whether it keeps sound (FR-293, U-29). | D-053 item 15 |

---

## 10. Revision history

| Version | Date | Changes |
|---------|------|---------|
| Draft 1 | 2026-11-20 | First draft. Fourteen questions (CQ-1 to CQ-14). |
| Draft 2 | 2026-11-20 | Answers to CQ-1 to CQ-14 applied. FR-279 to FR-284 added. Twelve new questions (CQ-15 to CQ-26). |
| Draft 3 | 2026-11-20 | Answers to CQ-16 to CQ-26 applied. FR-285 to FR-291 added. "Krea2" recorded and looked up. Public documents checked for cancelling and usage (Gemini, fal) and for temporary video files (ComfyUI). CQ-15 still open; CQ-20 open in part; CQ-27 to CQ-29 new. |
| Draft 4 | 2026-11-20 | D-053 applied. FR-292 (limit on agent runs) and FR-293 (optional video enlarging) added. FR-283 reversed: sound is kept. FR-286 widened to every video provider. FR-287 replaced by FR-303 to FR-305 in `REQUIREMENTS-D053.md`. FR-251, FR-276, FR-279, FR-281, FR-288 changed. Add-ons listed (Section 5.6). Built-in video enlarging and cut-out looked up (V-41, V-43). CQ-15, CQ-20, CQ-27, CQ-28, CQ-29 closed or replaced. CQ-34 to CQ-36 new. |
