# REQUIREMENTS-ComfyUI-Draft5.md

**Project:** Adman
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** Draft 5, revision 2, of `REQUIREMENTS-ComfyUI.md`, written as a separate part. It holds the new section "Custom workflows" and the changes to make to the Draft 4 text (Section C). CQ-37 to CQ-41 are answered (Section F.1). One question is open (CQ-42). Nothing here is in `REQUIREMENTS.md` yet.
**Source:** D-054 item 9, and the stakeholder's later answers (all word for word in Section F.1).
**Read against:** `REQUIREMENTS-ComfyUI.md` Draft 4, `REQUIREMENTS.md` 1.4 (FR-007 to FR-009, FR-050 to FR-054: how assets behave), `REQUIREMENTS-D053.md`, `REQUIREMENTS-D054.md`, `comfy-workflows/README.md`, the stakeholder's example (Section A).

## What this file is

An addendum for one new feature: the user adds their own ComfyUI workflows, and the app fills marked values in them. It says what is needed. It does not say how to build it.

Why it is a separate file: Draft 4 is long, and this part was written without a tool that edits a file in place. Section C lists each change to Draft 4, so the merge is mechanical. Until it is merged, Draft 4 plus this file is Draft 5.

The stakeholder's words (D-054 item 9):

> "Given that non-core modules may be required, we should allow the user to add their own custom workflows to a selectable list. My thinking is that a custom workflow may have variables included in it that we would want to allow the user to fill per generation / from the variant, such as reference images to load, first frame, text prompts, etc. But we want these to be simple and often automated when filling these values from the Adman UI."

The stakeholder also pointed to an example in another of his projects, "for a very rudimentary example for how that app targets fields in comfy workflows". Section A describes it.

Requirement numbers: FR-309 to FR-331. FR-332 and FR-333 are in `REQUIREMENTS-D054.md`. The highest number in use across all requirement files is FR-333.

---

## A. The stakeholder's example: how that app targets fields

Read on 2026-11-20, read-only. Nothing was copied from it.

1. **The files are in ComfyUI's "API" form.** Each file is a list of steps. Each step has an ID, a type, and its values. This is the same form the Adman drafts in `comfy-workflows/` use, and the form the app plans to send (V-3).
2. **A step is targeted by its ID.** There are two ways in the example.
   - **By a fixed name.** In some files the author changed a step's ID by hand, from a number to a name. The names seen: `PROMPT+` (the prompt), `PROMPT-` (the negative prompt), `PRIM_SEED` (the seed), `PREVIEW` (the step whose output is the result). The app writes the prompt into the value named `text` (and `string`) of the step called `PROMPT+`, and so on. Any file that uses these names works with no extra code.
   - **By a number, in code.** For the other files, the app's code holds a small table: for this file, the prompt goes into step "8", the negative prompt into step "9", the seed into step "4". Each new file with different numbers needs a new entry in the code.
3. **Only three things are filled:** the prompt, the negative prompt and the seed. A prompt is written only when one was given; otherwise the text in the file is kept. A seed is always written: the one given, or a random one.
4. **Everything else stays as it is in the file:** width, height, number of frames, frames per second, model files, LoRA files and strengths, steps. Some files hold these in small "variable" steps that other steps read from, but the app does not fill them.
5. **The result is found by name.** The app reads the output of the step whose ID is `PREVIEW`. In the picture files it is a preview step. In the video file it is a save-video step. The bytes come back over the live connection.
6. **No picture is filled in.** The example's helper code can upload a picture to the server, but the two generation paths read here do not use it to fill a workflow.
7. **Steps have a title too.** Files exported by newer ComfyUI versions carry each step's title (for example "Prompt"). The example does not use titles to target anything.

What this means for Adman:

- The fixed-name way is the simple one, and it is the idea kept. Changing a step's ID means editing the file by hand after each export. A step's **title** can be changed in ComfyUI's own screen, and it is in the exported file. The stakeholder chose titles (CQ-37, FR-313).
- The by-number way needs code for each file. It does not fit a workflow the user adds.
- The example fills far less than Adman needs: no size, no reference pictures, no first frame, no clip length.

---

## B. Custom workflows (proposed Section 4.21, continued)

Build order, decided (CQ-41): pictures and video first, extend a background later; built after the shipped stills and video workflows pass on the test machine; still in this build.

### B.1 A workflow is a linked file, like an asset

The stakeholder's words (CQ-38): "We can treat workflows like assets which are external files". So a custom workflow follows the asset rules of `REQUIREMENTS.md`: it belongs to a project (FR-050), it is linked where it is (FR-052), a file changed outside the app shows its new content (FR-009, notes), a file that cannot be found is marked missing (FR-009), and Package gathers it (FR-008). Where the answer does not settle a point, the text says "assumed" and names the assumption (Section E).

**FR-309:** The user can add a ComfyUI workflow file of their own to a project. They do it in the app, by choosing a file on their computer. The app links the file where it is. It does not copy, move or change it. An added workflow is called a custom workflow.
**Priority:** P0
**Notes:**
- As for any import, the dialog offers "copy into the assets folder" as a choice (FR-052). Assumed (A-C32).
- The app never writes to the user's workflow file. Everything the user sets for a workflow in the app (name, jobs, marks made in the app, size setting, last values) is kept in the project, beside the link.
- A workflow is its own kind of project file record. It is not in the reference library or the asset library (FR-054) and cannot be placed on a post.
- The same file can be added to more than one project. Each project has its own link and settings.
- **Acceptance:** after adding, the workflow is in the project's list (FR-311) and can be chosen for a run (FR-321); the user's file is byte-for-byte unchanged; adding needs no ComfyUI server to be reachable; the warning of FR-330 is shown before the workflow is saved.

**FR-310:** The app accepts a workflow in ComfyUI's "API" form, the form made with "Export (API)". A file in ComfyUI's normal saved form (the canvas form) is recognised and refused, and the app says in plain words how to make the API form. A file that is neither is refused as not a ComfyUI workflow. Nothing is added from a refused file.
**Priority:** P0
**Notes:**
- The example and the planned app agree: both use the API form (Section A; V-3).
- Accepting the canvas form as well is not planned.
- **Acceptance:** each of the three kinds of file gives its own plain message; the draft files in `comfy-workflows/` (top folder) are accepted; the files in `comfy-workflows/ui/` are refused with the "export the API form" message.

**FR-311:** The app shows the project's custom workflows in one list, beside the shipped ones. The user gives each a name when adding it, and can add a short description. The user can rename one and can remove one. Two workflows in a project cannot have the same name. Removing a workflow removes it from the project only. The file stays on disk (as FR-295), and nothing on the server is touched.
**Priority:** P0
**Notes:**
- "A selectable list" in the stakeholder's words. The list is per project, because assets are per project. Assumed (A-C31).
- The name starts as the file's name, so adding takes one step when the user does not care.
- A generated picture or video keeps its record of the workflow's name after the workflow is removed (FR-264).
- Where the list is shown (with the project's assets, or elsewhere) is for the design. The ComfyUI address stays in the app's Settings, outside any project (FR-253).

**FR-312:** A linked workflow file follows the linked-file rules.
- **Changed outside the app.** When the file's content changes, for example the user exports again from ComfyUI to the same place, the project uses the new content. The app reads the variables again. When they are the same as before, nothing is asked. When they differ, the app shows the review again (FR-314) before the next run that uses the workflow. The warning of FR-330 applies.
- **Missing.** When the file cannot be found, the app marks the workflow as missing wherever it is shown, and lets the user point to the file's new place (FR-009). A run with a missing workflow does not start. The app never picks a different workflow silently. A missing workflow does not stop any export.
- **Pointed to another file.** The user can point a workflow at a different file. The name, the jobs and the settings are kept where they still fit, and the review is shown again.
**Priority:** P0 for changed and missing; P1 for pointing to another file
**Notes:**
- Whether a run already waiting uses the old or the new content is for the spec. A run that has been sent is never changed.
- "The variables differ" and "an agent's run meets a changed file" are covered by assumption A-C33: runs that use the workflow wait for the user's review; nothing else is held back.

**FR-326:** Package and other computers. "Package project" (FR-008) gathers each linked workflow file with the project, as it does every linked file, so the packaged project opens on another computer with its workflows present. A workflow file is not published to cloud storage (FR-162) and is not part of any export. The ComfyUI address is never packaged (FR-253).
**Priority:** P0
**Notes:**
- This follows from "like assets". It reverses revision 1, which kept workflows per computer and out of packages.
- A workflow that works on one server may lack models or add-ons on another. The app says what is missing (FR-325).
- A project received from someone else now brings workflow files with it. What the app does the first time such a workflow is used is CQ-42.

### B.2 Variables

A variable is a value in the workflow that the app fills for each run. Everything that is not a variable is sent as it is in the file.

**FR-313:** The user marks a variable inside ComfyUI's own screen, before exporting, by giving the step that holds the value a title from a short, fixed list of names. The app shows that list where a workflow is added. Marking needs no code and no editing of the exported file by hand.
**Priority:** P0
**Notes:**
- Decided. The stakeholder's words (CQ-37): "I like by step title in Comfy".
- The exact names are for the spec. They must be short and plain, and must cover the kinds in FR-316. The shipped workflows use the same names, so one rule serves both.
- A title marks a step. Which value inside the step is filled is worked out by the app from the kind of variable. Where a step holds more than one value that could be meant, the review (FR-314) shows which one was taken.
- Seen in the stakeholder's example and in the Adman drafts: an exported API file carries each step's title. Not read on a ComfyUI page (U-34).
- **Acceptance:** a user who can use ComfyUI's screen can mark a prompt, a seed and a result, export, add the file, and run it, without opening the file in a text editor.

**FR-314:** When a workflow is added, the app shows what it found: each variable, its kind, the step it is in, and the value the file holds now. It shows the result step (FR-322), and the jobs it thinks the workflow can serve (FR-321). The user confirms before the workflow joins the list. A mark the app does not understand is shown as such and is not filled.
**Priority:** P0
**Notes:**
- This is where "simple and often automated" is met: for a well-marked file the user reads one screen and confirms.
- A workflow with no variables at all can still be added. It runs exactly as written. The app says that the prompt and the variant will not affect it.

**FR-315:** On the same screen the user can mark a variable themselves, without going back to ComfyUI: they pick a value in the workflow and give it a kind. They can also take a mark away. For a file with no marks, the app proposes the likely prompt, seed, size and result, and the user confirms or corrects them.
**Priority:** P1
**Notes:**
- For workflows that came from someone else, or were exported before the user knew the names.
- Marks made in the app are kept in the project. The user's file is not changed (FR-309).
- Nothing is filled that the user has not confirmed.
- Saving changed marks is "editing" the workflow: the warning of FR-330 is shown.

**FR-316:** The app understands these kinds of variable.

| Kind | What it is | Priority |
|------|------------|----------|
| Prompt | The text that describes the picture or video. | P0 |
| Negative prompt | Text that says what to avoid. | P0 |
| Seed | The number that makes one result differ from the next. A workflow may have more than one. | P0 |
| Width, height | The result's size in pixels. | P0 |
| Reference picture, numbered | A place where a reference picture is loaded. A workflow may have several, numbered from 1. | P0 |
| First frame | The place where a video's start picture is loaded. | P0 |
| Clip length | How long the video is. The workflow may want it as a number of frames or in seconds. | P0 for video |
| Frames per second | The video's frame rate. | P1 |
| Result | The step whose output is brought back (FR-322). | P0 |
| Source picture and added border | For extend a background: the picture to extend, and how much to add on each side. | P1 |
| Extra value | Any other value the user wants to set per run: a line of text, a number, an on/off switch, or one of a list of choices. The user gives it a label. | P1 |
| Extra picture | A place where a picture the user chooses per run is loaded. | P2 |

**Notes:**
- Prompt, negative prompt, seed and result are the ones in the example. Its files also hold size, frame count, frame rate and LoRA strength as values a user might want to set; the first three have kinds of their own here, and the rest are covered by "extra value".
- Model files and LoRA files are not variables. A user who wants another model adds another workflow.
- **Acceptance:** for each P0 kind, a marked test workflow receives the right value at run time, and the value can be seen in what the app sent.

**FR-317:** The app fills these variables by itself. The user is not asked.

| Kind | Filled from |
|------|-------------|
| Prompt | The prompt in the generation panel (FR-062), as the user left it. |
| Seed | A new number for each option of each run, so options differ (FR-257). |
| Width, height | The variant's ratio, at the size the workflow is set to make (FR-324). |
| Reference picture 1, 2, ... | The subject's reference files that the generation panel attached (FR-062), in the order shown there. |
| First frame | The variant's finished background picture, when the user chose to start from a first frame (FR-286). |
| Clip length, frames per second | The variant's duration and the workflow's own frame rate. |
| Source picture and added border | The background being extended and the new ratio (FR-076). |
| Result | Nothing is filled. The app reads its output. |

**Priority:** P0
**Notes:**
- The stakeholder's words: "simple and often automated when filling these values from the Adman UI".
- Pictures are sent to the server under the same rule as for a shipped workflow (FR-260), and turned into a form the workflow can take first (FR-298).
- The app has no negative prompt of its own today. So the negative prompt is not in this table (FR-318).
- The picture model is asked not to draw text (FR-061), in the same way as for a shipped workflow.
- When the variant's duration is longer than the workflow can make, the app says so before the run (FR-262).

**FR-318:** These variables are asked from the user, on the confirmation dialog, before the run: the negative prompt, and every extra value and extra picture. Each starts with the value that is in the file. The user can run without touching any of them. The app remembers the last values used with that workflow.
**Priority:** P0 for the negative prompt; P1 for extra values
**Notes:**
- "Fill per generation" in the stakeholder's words.
- The automatic variables are not shown as fields. The asked ones are grouped under one heading, closed unless the user opens it.

**FR-319:** The app changes only the values of confirmed variables. Every other part of the workflow is sent to the server exactly as it is in the file. When the app has nothing to put in a variable, the value in the file is kept.
**Priority:** P0
**Notes:** The user can see, for a finished run, the values the app filled in. For a picture place left empty, see FR-320.

**FR-320:** A run never fails partway because a picture place was not filled. Before the run starts, the app compares the pictures it has with the picture places the workflow has. When there are more reference pictures than places, the app says so and none is dropped silently (as FR-260). When there are fewer pictures than places, or a first frame is needed and there is none, either the run is made to work without them or it is refused before it starts with a plain reason. Which of the two is for the architect, per kind.
**Priority:** P0
**Notes:** This is open question 2 in `comfy-workflows/README.md`, and it applies to shipped workflows too.

### B.3 Jobs and results

**FR-321:** Each custom workflow serves one or more of the app's ComfyUI jobs: a picture from a prompt, a picture from a prompt and reference pictures, a video (with the kinds of start it has places for, FR-286), and extend a background. The app proposes the jobs from the variables and the result it found. The user confirms them when adding. For each job, the project's custom workflows that serve it are offered beside the shipped ones wherever a workflow is chosen (FR-256, FR-288). The user can set one as the project's default for a job.
**Priority:** P0 for pictures and video; P1 for extend a background
**Notes:**
- Decided (CQ-41: "Good rec"): pictures and video first, extend later.
- A workflow with no "reference picture" place is not offered when reference pictures are attached, unless the user chooses to run without them. A workflow with no "first frame" place is not offered for a video that starts from a first frame.
- Cut-out (FR-307) as a job for a custom workflow is not asked for and is not included.
- **Acceptance:** a custom stills workflow appears in the workflow choice for a picture run and not for a video run.

**FR-322:** The app finds a run's result at the step marked as the result. The result is one or more pictures, or one video. When the workflow has exactly one step that puts out a picture or a video, that step is the result without a mark. When it has several and none is marked, the user chooses one when adding. A workflow with no such step is refused when adding. The kind of result must fit the job: a picture for the picture jobs and for extend, a video for the video job.
**Priority:** P0
**Notes:**
- The example does this with a step named `PREVIEW`.
- The result is stored like any other ComfyUI result: pictures as PNG (FR-299), video with its sound (FR-283), with "ComfyUI" as provider, the model file names found in the workflow, and the workflow's name marked as custom (FR-264). It does not carry the server's address (FR-253).
- What the server sends back is handled as for a shipped workflow (FR-277). That rule is about the server's answers, not about the workflow.
- A custom workflow may save files in the server's output folder. FR-282 holds only for shipped workflows. FR-271 still holds.
- When a step puts out several pictures in one run, each is an option.

**FR-323:** A run with a custom workflow follows every rule of a ComfyUI run: the confirmation dialog with the address and the workflow's name (FR-256); one variant at a time, the number of options asked for, never counted as paid (FR-257); progress (FR-269); cancelling (FR-270, FR-281); failures and lost contact (FR-265 to FR-268); only the saved address is contacted (FR-274, FR-275). Each option is a separate filling of the workflow with a new seed. When a workflow has no seed variable, the app says before the run that the options may all be the same.
**Priority:** P0

**FR-324:** For a workflow with width and height variables, the app fills a size that has the variant's ratio. For each custom workflow the user can set the size its model wants: about how many pixels in total, and the step that width and height must be a multiple of. The app starts with a sensible setting, so the user need not touch it. When a workflow has no width and height variables, it makes the size written in the file; the app says before the run when that size does not have the variant's ratio. A result of a different pixel size from the variant is treated as for any other provider (A-C3).
**Priority:** P0
**Notes:** Models differ: the shipped ones want multiples of 16 or 32 and about 1 to 2 megapixels (V-19, V-22). The same place holds the longest clip a video workflow can make. The starting setting is for the spec.

**FR-325:** Missing models and add-ons. The app works out what a custom workflow needs from the file itself: the kinds of step it uses and the model files it names. When a ComfyUI server answers (FR-252), and when a workflow is added while the server can be reached, the app compares that with what the server reports and names each missing item. A run does not start when something is known to be missing (FR-266). When the server refuses or fails a run for a reason the app did not foresee, the plain message comes first and the server's own text is available on request (FR-267). The app installs nothing.
**Priority:** P0
**Notes:**
- For a custom workflow the needs can only be read from the file. So the list may lack the folder a model file belongs in, and it has no ComfyUI version.
- A missing kind of step usually means an add-on is not installed. The app shows the step's name as the file has it.
- This is a help for getting a run to work. It is not a safety check, and nothing in a workflow is judged or blocked by it (FR-329).
- **Acceptance:** a workflow that names a model file the test server lacks is reported with that file's name before any run starts.

### B.4 External agents

**FR-327:** When the ComfyUI tick is on (FR-279), an external agent can start a run with a custom workflow that is in the open project's list, by its name, within the limit of FR-292. The agent can see the names and jobs of the workflows in the list. It cannot add, point elsewhere, rename or remove a workflow, cannot read a workflow's contents, and cannot send a workflow of its own. It supplies what it would for a shipped workflow: the variant, the job, the prompt, the number of options, the start choice for a video. Asked variables (FR-318) take their saved values in an agent's run.
**Priority:** P0
**Notes:**
- Decided. The stakeholder's word (CQ-39): "Yes". The question put was option (a): any workflow in the list, by name; the agent cannot add or change one.
- An agent can add assets to a project in general (FR-200). A workflow is the exception: only the user adds one (FR-328).
- A missing workflow, or one waiting for the user's review after its file changed (FR-312), is refused to the agent with a plain reason.
- From the same answer, for all agent runs (these belong to CQ-34 in Draft 4 and are listed in Section C, W-23 to W-26): an agent can pick one of a run's results, but is encouraged not to; an agent may cancel only runs it started; Gemini gets no tick; unticking applies only to runs not yet sent.

### B.5 Trust and the warning

Decided by the stakeholder (CQ-40): "Assume that all loaded comfy workflows are trusted. We can show a warning when saving/editing new workflows".

**FR-328:** A workflow that runs on the user's server comes only from the set shipped with the app, or from the custom workflows in the open project (FR-309). A custom workflow enters a project only by the user adding it in the app, or by already being in a project file the user opens. A workflow is never taken from a brief, from an imported asset of another kind, from an external agent or from the server.
**Priority:** P0
**Notes:**
- This replaces FR-278.
- Changed from revision 1, which said "never from a project file". With workflows treated like assets, a project file holds links to workflow files, and a packaged project brings the files (FR-326). So opening a project made by someone else loads their workflows into that project. Whether opening counts as "loaded" in the sense of the trust decision is assumed yes (A-C29). What the app shows the first time is CQ-42.
- A project file from someone else can also name any path on this computer as a workflow. The app would read that file and, on a run, send its content to the user's own ComfyUI server. The stakeholder has accepted the like case for assets (D-054 item 3: "Not concerned about these cases"). It is noted here and not guarded against.

**FR-329:** A custom workflow that is loaded is trusted. The app runs it as it is. The app does not inspect a workflow's contents for safety, does not limit what steps it may hold, does not block or sandbox any part of it, and asks for nothing more at each run because of what is in it.
**Priority:** P0
**Notes:**
- The stakeholder's words: "Assume that all loaded comfy workflows are trusted."
- The user is the one who judges a workflow. The warning of FR-330 tells them why that matters.
- The app still reads the file to find variables, the result and what the server is missing (FR-314, FR-325). That is to make the run work. It judges nothing.
- The app sends a workflow to the saved ComfyUI address and nowhere else (FR-274).

**FR-330:** The app shows a warning when a custom workflow is saved or edited. It says in plain words that a workflow can read, write or run things on the ComfyUI server, and that it should come from a source the user trusts. The user can go on or go back. The warning is not shown at each run. It is shown:
- when the user adds a workflow to a project (FR-309);
- when the user saves changed marks or points the workflow to another file (FR-315, FR-312);
- once, when the app finds that a linked workflow file was changed outside the app, the next time the user uses that workflow.
**Priority:** P0
**Notes:**
- The stakeholder's words: "We can show a warning when saving/editing new workflows".
- The third case is assumed (A-C30). The file lives outside the app, so an edit made in ComfyUI or a text editor is the usual kind of edit, and the app only learns of it afterwards.
- The wording is the same for every workflow. It does not depend on what the workflow holds.
- Renaming a workflow or changing its description needs no warning.
- **Acceptance:** the warning appears in the three cases above; it does not appear on a run of an unchanged workflow, on a rename, or for a shipped workflow.

**FR-331:** Where custom workflows are added, the app says once that the licence of any model or add-on a custom workflow uses is the user's responsibility (as FR-285). It does not check and does not block.
**Priority:** P1

---

## C. Conflicts with existing text, and the change for each

`REQUIREMENTS-ComfyUI.md` Draft 4 and `REQUIREMENTS.md` were not edited. Each row needs a change when this file is merged.

| # | Where | What it says today | What the decisions need |
|---|-------|--------------------|-------------------------|
| W-1 | CQ-1, answer 1 (Section 6.1) | "Shipped workflows only for now". | Superseded by D-054 item 9. Keep the old answer for the record. |
| W-2 | Section 1, Summary | "The user cannot add their own in this build." | "The user can also add their own (Draft 5, Section B)." |
| W-3 | FR-258 | "In this build the shipped workflows are the only ones the app can run." | Remove the sentence. Point to FR-309 to FR-331. |
| W-4 | FR-278 and its note | A workflow "comes only from the set shipped with the app"; "never taken from a project file, a packaged project". | Replaced by FR-328. A loaded workflow is trusted (FR-329). A project file and a package now do carry workflows (FR-326). |
| W-5 | Section 4, out of scope, decided | "Loading the user's own workflow files". | Remove. Add under "No longer out of scope". |
| W-6 | Section 4, out of scope, proposals | "Building or editing a workflow inside the app." | Stays out. Marking a variable in the app (FR-315) is not building a workflow. |
| W-7 | Section 4, out of scope, proposals | Paid "partner" steps: "The shipped workflows use only models that run on the server itself." | True for shipped. A custom workflow may hold such steps. The app does not look for them or count their cost. |
| W-8 | FR-280, notes | "the agent uses only the shipped workflows (FR-278) ... It cannot name ... a workflow file". | An agent may name a custom workflow in the project's list (FR-327). It cannot supply a file. |
| W-9 | FR-263 | "Each shipped workflow states what it needs". | Unchanged for shipped. For custom, read from the file (FR-325). |
| W-10 | FR-282, FR-271 | Results come back without a copy in the output folder where ComfyUI allows. | Holds for shipped workflows only (FR-322). |
| W-11 | FR-264 | Metadata carries "the name and version of the workflow". | A custom workflow has a name and no version; marked as custom. |
| W-12 | FR-285 | Licence statement for "a shipped workflow". | Custom workflows: FR-331. |
| W-13 | FR-288 | Alternates are a second shipped workflow for a job. | The same choice also lists the project's custom workflows (FR-321). |
| W-14 | FR-290, notes | Hand-test screen: "workflows are only the shipped ones (FR-278)". | Point to FR-328. Whether it can add a custom workflow is for the architect. |
| W-15 | Section 3.3 "Add-ons"; CQ-35 | A shipped workflow may need an add-on only where no built-in way works. | D-054 item 9 read as a partial answer: add-on needs go through custom workflows (A-C23). CQ-35 stays open only for the Krea 2 extend case. |
| W-16 | Glossary, "Shipped workflow" | "The only kind the app runs in this build." | Remove the sentence. Add Section G. |
| W-17 | `REQUIREMENTS-D053.md` FR-307, notes | Cut-out on ComfyUI: "shipped workflow only, FR-278". | Point to FR-328. Cut-out stays shipped. |
| W-18 | `REQUIREMENTS.md` FR-067 | Default provider per job, changeable on the dialog. | For ComfyUI the user also chooses the workflow (FR-321). |
| W-19 | `REQUIREMENTS.md` FR-064; FR-256 | The dialog shows count, address, workflow. | Also the asked variables of a custom workflow (FR-318). |
| W-20 | `REQUIREMENTS.md` 8.4, threat notes | No user-supplied recipe runs anywhere. | Add FR-328 to FR-330 in short. |
| W-21 | `comfy-workflows/README.md`; SPEC 6.10.4 as quoted there | Drafts mark filled values with "APP" in the title; the filling step "removes no node". | Use the names of FR-313. FR-320 may need the filling step to do more. For the architect. |
| W-22 | `REQUIREMENTS.md` FR-008, FR-009, FR-050 to FR-054, 6.1 data entities | Linked files are assets: images, video, text, fonts (and audio, FR-301). | A workflow file is one more kind of linked file, with its own list; packaged; marked missing; never placed on a post (FR-309, FR-312, FR-326). |
| W-23 | Draft 4, CQ-34 and FR-280 ("its result waits for the user") | Open: may an agent pick a result. Recommended: no. | Answered: "An agent can technically pick results, but they should be encouraged not to." An agent can pick; the guidance given to agents says to leave the choice to the user. |
| W-24 | Draft 4, CQ-34, FR-281 | Open: may an agent cancel. | Answered ("Other recs are good"): yes, only runs it started. |
| W-25 | Draft 4, CQ-34, FR-279 | Open: Gemini has no tick. | Answered ("Other recs are good"): confirmed, no tick. |
| W-26 | Draft 4, FR-279 and A-C20 | "Runs that are already waiting or running are not touched by unticking". | "Unticking should only apply to runs not yet sent". Read as: a run already sent to the provider carries on; an agent-started run the app has not yet sent is not sent. Draft 4 kept waiting runs too. The line between "waiting on the server" (sent) and "waiting inside the app" (not sent) must be stated. |
| W-27 | Draft 4, CQ-34: the limit of 4 for all providers or per provider; FR-268 to P0 | Open, each with a recommendation. | The stakeholder's "Other recs are good" covers them as the orchestrator reads it. The analyst did not see the full message; confirm before FR-292 and FR-268 are changed. |

---

## D. Facts not verified (additions to Section 5.5)

| # | Point | Why it matters |
|---|-------|----------------|
| U-34 | That every ComfyUI version in use writes each step's title into the exported API file. Seen in the stakeholder's newer example files and in the Adman drafts; the oldest example file has no titles. | FR-313. |
| U-35 | That a server's answer about its step types (V-7) is enough to name every missing kind of step in a custom workflow. | FR-325. |

---

## E. Assumptions (additions to Section 7)

| # | Assumption | Impact if wrong |
|---|------------|-----------------|
| A-C23 | "Given that non-core modules may be required" means: add-on needs are met by custom workflows, and shipped workflows stay on ComfyUI's own parts. | CQ-35 stays fully open. |
| A-C24 | "Selectable list" means the custom workflows appear where a workflow is chosen for a run, beside the shipped ones, per job. | FR-321 changes. |
| A-C25 | "From the variant" means the variant's ratio, duration, finished background, and its subject's reference files. | FR-317 changes. |
| A-C26 | The user who adds a workflow can use ComfyUI's own screen to rename a step and export. | FR-315 would need to be P0. |
| A-C27 | A custom workflow is for the ComfyUI server only. | None expected. |
| A-C29 | A workflow is "loaded" when it is in a project the user has open, whether this user added it or it came with the project file. | If only workflows this user added count, a workflow that came with a project must be added again before it runs (CQ-42). |
| A-C30 | "Saving/editing" covers: adding a workflow, saving changed marks, pointing to another file, and a file found changed outside the app (warned once, at next use). Not renaming, and not each run. | FR-330 shows the warning at more or fewer moments. |
| A-C31 | "Like assets" means per project: each project has its own list of workflows, as it has its own assets. There is no list shared by all projects on the computer. | FR-311, FR-321 and FR-327 change; a user with many projects adds the same file to each. |
| A-C32 | "Like assets" includes the import choice "copy into the assets folder" (FR-052), and Package gathering the file (FR-008). | FR-309 and FR-326 change; a packaged project would open elsewhere with its workflows missing. |
| A-C33 | When a linked workflow file changes and its variables no longer match what the user confirmed, runs with that workflow wait for the user's review, agent runs included. When the variables still match, the new content is used with no question, as for a changed asset. | Either every change needs a review (less simple), or none does (a run may be filled wrongly). |
| A-C34 | A workflow file is not published with a campaign's components and is not listed in the export report beyond its name. | FR-326 changes. |

A-C28 of revision 1 is closed by the CQ-37 answer.

---

## F. Questions for the stakeholder

### F.1 Answered

| # | Question | Answer | Applied in |
|---|----------|--------|------------|
| CQ-37 | How does the user mark a variable? | "I like by step title in Comfy" | FR-313 |
| CQ-38 | Are custom workflows kept on the computer or in the project? | "We can treat workflows like assets which are external files" | FR-309, FR-311, FR-312, FR-326, FR-328 |
| CQ-39 | May an outside agent run a listed custom workflow under the same ComfyUI tick? | "Yes" | FR-327 |
| CQ-40 | Custom workflow safety: what should the app do about a workflow that could read, write or run things on the server? | "Assume that all loaded comfy workflows are trusted. We can show a warning when saving/editing new workflows" | FR-329, FR-330 |
| CQ-41 | Which jobs, and when: pictures and video first, after the shipped workflows pass? | "Good rec" | Section B opening, FR-321 |

From the same message, on agent runs in general (CQ-34 of Draft 4): "An agent can technically pick results, but they should be encouraged not to. Other recs are good." and "Unticking should only apply to runs not yet sent". Applied as rows W-23 to W-27; not yet written into Draft 4.

How the answers were read:
- CQ-38 was not the analyst's recommendation. It is read as: a workflow is a file outside the project that the project links to, with the asset rules for linking, changes, missing files and Package (Section B.1). Points the answer does not settle are assumptions A-C29 to A-C34, and CQ-42.
- CQ-39 "Yes" is read as the option that was put: by name from the list; no adding or changing by the agent.
- CQ-41 "Good rec" is read as all three parts: pictures and video first; after the shipped workflows pass; still in this build. So the priorities are no longer "proposed".

### F.2 Open

**CQ-42. A workflow that came with a project from someone else: is anything shown before its first run?**
- With workflows treated like assets, a packaged project brings its workflow files, and they are in the project's list when it is opened (FR-326, FR-328). The user did not add them, so they never saw the warning.
- (a) Nothing. An open project's workflows are loaded, and loaded workflows are trusted.
- (b) The same warning, once, the first time this computer uses a workflow this user did not add. Until the user has seen it, an agent cannot run that workflow.
- (c) Package leaves workflow files out, so the user adds them by hand on the other computer.
- Recommendation: (b). It is the warning you already asked for, shown at the one moment a workflow can reach your server without you having chosen it. It inspects nothing and blocks nothing once seen. The text is written to (a) until you answer (A-C29).

Answered in part by D-054 item 9: CQ-35 (W-15, A-C23). CQ-36 is unchanged and still open.

---

## G. Glossary additions

| Term | Definition |
|------|------------|
| Custom workflow | A workflow file the user added to a project (FR-309). Linked where it is, like an asset. Trusted when loaded (FR-329). |
| Variable | A value in a workflow that the app fills for each run (Section B.2). |
| Mark | What tells the app that a value is a variable, and of which kind: the step's title (FR-313). |
| Result step | The step in a workflow whose output the app brings back (FR-322). |
| API form | The form of a workflow file made with "Export (API)" in ComfyUI. The form the app accepts and sends (FR-310). |
| Canvas form | ComfyUI's normal saved form of a workflow. Not accepted (FR-310). |
| Asked variable | A variable the user can set on the confirmation dialog before a run (FR-318). |

---

## H. Revision history

| Version | Date | Changes |
|---------|------|---------|
| Draft 5 | 2026-11-20 | D-054 item 9 applied. New section "Custom workflows": FR-309 to FR-331. FR-278 replaced by FR-328. The example described (Section A). CQ-37 to CQ-41 new. |
| Draft 5, revision 1 | 2026-11-20 | Trust decision applied. FR-329: a loaded workflow is trusted. FR-330: a warning on save or edit. Risk table and step listing removed. CQ-40 answered. |
| Draft 5, revision 2 | 2026-11-20 | CQ-37, CQ-38, CQ-39, CQ-41 answered and applied. Workflows are linked files like assets, per project: FR-309, FR-311, FR-312, FR-326, FR-328, FR-330 rewritten; sections reordered (B.1 now holds linking, changes, missing files and Package). FR-313 and FR-327 decided. Priorities no longer "proposed". Agent answers recorded (W-23 to W-27). W-22 rewritten for assets. A-C29 and A-C30 changed; A-C31 to A-C34 new; A-C28 closed. U-36 dropped. CQ-42 new. |
