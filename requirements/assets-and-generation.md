# Requirements: asset import and AI generation

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.6 Asset Import and Reuse

**FR-050:** The user can add a local folder or individual files to the project.
**Priority:** P0

**FR-051:** Accepted file types are images, video, text content (files containing copy or briefs: txt, md, JSON, YAML) and font files.
**Priority:** P0

**FR-052:** By default, importing links each file where it is. The file is not copied or moved. The import dialog offers "copy into the assets folder" as a choice, which saves a copy in the project's assets folder (FR-007) instead.
**Priority:** P0
**Changed in 1.1:** R-08. Before, imported files were always copied into the project folder.

**FR-053:** Imported assets remain available between sessions and are reused when available instead of generating new ones.
**Priority:** P0
**Notes:** A linked file that has been moved or deleted is handled as in FR-009.
**Changed in 1.1:** R-06 (notes only).

**FR-054:** A project has two libraries. The reference library holds files used only as input to image generation. The asset library holds files that can go on a post. On import the user chooses the library. The user can attach a file to a subject on import or later, so the app can offer it when that subject is used.
**Priority:** P0
**Notes:** A hero image is an asset-library image attached to a subject.
**Changed in 1.1:** R-12. Before, imported files went into one project pool.

**FR-055:** For each subject the app handles three cases:
- The subject has a hero image (an asset-library image attached to it). The image can be used as-is.
- The subject has only reference-library files (for example a product shot). They are sent to the image model to build a new scene.
- The subject has no files. An image is generated from the subject description and campaign message.
**Priority:** P0
**Notes:** Generating the subject at new angles and in new scenes from its photos is a core use. Every photo of a subject, in either library, is offered and chosen at the start as a reference for the image model, and any of them can be placed in an ad (FR-011).
**Changed in 1.1:** R-12. The three cases are now told apart by library.
**Changed after 1.4:** R-21. Before, a hero image was always used as-is.

**FR-056:** Uploaded fonts can be used on text layers. Non-Latin left-to-right scripts (for example Chinese, Japanese, Korean) can use their own font.
**Priority:** P0

### 4.7 AI Generation

**FR-060:** When assets are missing, the app can generate new ones with an AI image model.
**Priority:** P0

**FR-061:** The image model never draws text. Text layout is proposed separately and the app renders it as editable text layers. A layout proposal can come from three sources: a third-party vision API on the user's key, an external agent through the MCP server (4.18), or the user placing text by hand.
**Priority:** P0

**FR-062:** The generation panel pre-fills a prompt from the brief (subject, audience, region, message) and attaches the subject's reference files. The user can edit the prompt.
**Priority:** P0

**FR-063:** Each run produces a number of options that the user can set. The user picks one or runs again.
**Priority:** P0
**Notes:** The user does not have to pick at the moment the run finishes. The options stay available and can be reopened later (FR-216).
**Changed in 1.4:** D-028 (notes only).

**FR-064:** Before a run starts, a confirmation dialog shows how many generations it will use.
**Priority:** P0

**FR-065:** All image and video generation is started by the user in the app, for one variant at a time. The master variant is built first.
**Priority:** P0
**Notes:** "One variant at a time" means each run is for one variant. It does not mean only one run can be in progress. The user can start a run for another variant while an earlier run is still going (FR-215).
**Changed in 1.4:** D-028 (notes only).

**FR-066:** Every generator (image, layout, text, video) sits behind a provider boundary so providers can be swapped.
**Priority:** P0

**FR-067:** The user sets a default provider for each AI job in Settings. On the confirmation dialog before each run, the user can change the provider for that run. A provider that is not working yet is listed but disabled and marked as not yet available.
**Priority:** P0

**FR-068:** Each generated asset carries the provider, model and prompt that made it, embedded in the file's own metadata in a form other tools can read. This applies to generated assets only. Final exports do not carry it.
**Priority:** P0
**Notes:** The stakeholder's reference is how ComfyUI embeds generation details in its image files. The same details are used in the export report (FR-150).

**FR-069:** Provider failures (bad key, quota used up, content refused, timeout) are shown as plain-language messages with the reason and a retry action. Raw error codes are never shown.
**Priority:** P0
