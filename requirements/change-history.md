# Requirements: what changed in each version

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 9.5 Changes to decisions in the original brief

| Original decision | Now |
|-------------------|-----|
| With cloud storage, assets survive reinstall by re-entering storage details | Dropped. The project file and its asset files on disk are the durable copy. Cloud is for sharing finished work. |
| The app finds existing assets from campaign and product IDs alone, with no hidden local index | Applies only to the published cloud layout, which must be browsable without the app. Locally, the project file is the index. |
| Source assets are shared across campaigns | True within a project. Not across projects. |
| "Products" | Renamed "Subjects". Still needs a unique ID. |
| Paths such as `outputs/{campaign-id}/{product-id}/{ratio}/post.png` | Export layout is by campaign, post title and ratio, with language and variant ID in the file name. The title defaults to the subject IDs. |
| A configurable local storage folder | Replaced by a default project location plus a location per project, and an assets folder location per project (FR-007). |
| Changes sync across localizations | Sync is manual, reviewed per variant, and skips overrides. |
| A vision model proposes the text layout | Still available. An external agent through MCP, or the user by hand, can do it instead. |
| Video: static text overlay on one generated video | Extended with a timeline, a multi-clip background track, and entrance and exit text animations. |
| "This will be OSS" | Public code with no commercial reuse by others (see 9.3). |

### 9.6 Changes agreed during architecture (version 1.1)

The stakeholder agreed each of these in the design dialogue with the architect. SPEC.md Section 0 is the source. R-12 and R-13 were proposed three times and not corrected, and are treated as accepted. Mechanisms (file format, protocols, libraries) are in SPEC.md, not here.

| # | Agreed change | Requirement text changed | Also touched |
|---|---------------|--------------------------|--------------|
| R-01 | An agent creates a campaign by sending structured brief fields. No AI extraction call and no confirm form for an agent. The campaign appears at once. An agent can delete a campaign it created. *(Corrected in 1.2, D-010: this row said "can be undone". The stakeholder meant delete, not undo.)* | FR-195 | FR-022 notes, FR-023 notes, workflow 5.7 |
| R-02 | In fan-out, a variant that differs from the master in both size and language copies its text position and size once from the variant with the same size in the master's language. One-time copy, not a link. | FR-079 | FR-075 notes, FR-078 notes, workflow 5.2 |
| R-03 | Word lists are per language. Required words are checked against a variant's combined text. Prohibited words are checked in every text layer. | FR-033, FR-113 | FR-021 notes, 6.1 Rule set, glossary |
| R-04 | The MCP server needs a token as well as accepting only same-computer connections. | FR-191 | IR-003, 8.4, 8.9, workflow 5.7, glossary |
| R-05 | Image and video variants can share one master. Format is a fan-out choice. Timing and animation are stored on every layer and follow the master. | FR-079 | FR-075 notes, 6.1 Layer and Background clip |
| R-06 | A project is a single file with a custom extension. It links to asset files that stay where they are. | FR-001, FR-002, new FR-009, A-01 | 1.4, FR-053 notes, 6.1 Project, Asset and Variant, 6.2, 6.3, 8.4, 8.9, 9.5, glossary |
| R-07 | Generated files go to a folder beside the project file, named after it. The user can change the location per project. | FR-001, new FR-007 | 6.1 Project, 9.5, glossary |
| R-08 | Import links files by default. The import dialog offers "copy into the assets folder". | FR-052, C-07 | FR-007, 6.1 Asset, 8.9, glossary |
| R-09 | "Package project" gathers the project file and all linked files into one folder. This is how a project moves to another machine. | 1.3 portability criterion, new FR-008 | 1.4, FR-001 notes, 8.9, glossary |
| R-10 | Saved keys can never be viewed. The last four characters are shown. The user can replace or delete a key. | FR-173 | 1.4, 8.4 |
| R-11 | An agent can list assets and fonts by name and ID, without file contents. | FR-192 | 6.3 |
| R-12 | Two libraries: reference (input to image generation only) and asset (can go on a post). A hero image is an asset-library image attached to a subject. | FR-054, FR-055, C-07 | FR-011 notes, 6.1 Project and Asset, glossary |
| R-13 | Definition of "present and visible" for a required asset. Cover by another layer is not tested. | FR-110 notes | |
| R-14 | No GSAP. | 9.1 | |
| R-15 | S3 and Dropbox work in this build. Azure is listed but disabled. | FR-160, C-03 | 1.4, Section 7 table |
| R-16 | Installers are unsigned in this build. First-launch security warnings are accepted. | 8.7 | 1.4 |
| R-17 | One undo list per variant and one per campaign. Deleting a variant can be undone from the campaign list. | FR-095 | |
| R-18 | Export also warns about unapproved translations and overflowing text, handled like brand and legal warnings. | FR-114, FR-115, new FR-116 | workflow 5.6, glossary |
| R-19 | The licence is PolyForm Noncommercial 1.0.0. | 9.3, OI-02 | |

New requirement numbers in 1.1: FR-007, FR-008, FR-009, FR-116. No existing number was changed or reused.

### 9.7 Stakeholder answers applied in version 1.2

The analyst raised questions on version 1.1. The stakeholder's answers are recorded in `DECISIONS.md` as D-010 to D-017. Rows R-05, R-09 and R-10 in Section 9.6 are left as the record of what was agreed at the time. The rows below add to them.

| # | Answer | Requirement text changed | Also touched |
|---|--------|--------------------------|--------------|
| D-010 | A campaign created by an agent is not undone. The agent can delete a campaign it created. A delete is not an undo. It needs the user's permission like any agent delete (FR-197). | FR-195 | FR-200, workflow 5.7, 9.6 row R-01 |
| D-011 | A packaged project includes everything related to the project: the project file, linked files, and the files in the assets folder. *(Refined in 1.3, D-022: see Section 9.8.)* | FR-008 | glossary |
| D-012 | An image variant can be changed to a video variant. Whether a video variant can go back to image is not decided (Q-015). *(Answered in 1.3, D-020: it can. See Section 9.8.)* | FR-120 | FR-075 notes |
| D-013 | Reading, not yet confirmed (Q-016): position and size follow the master only between variants of the same pixel size. *(Confirmed in 1.3: see Section 9.8.)* | FR-079 notes | |
| D-014 | The agent access token is for use on the local computer. The user can view and copy it. Provider and storage keys can still never be viewed. | FR-173 | FR-191 notes, 1.4, 8.4, glossary |
| D-015 | Needing the README for the standard first-launch steps of an unsigned app is an accepted exception. | 8.7, 1.3 | |
| D-016 | Accepted as written in 1.1: missing-file handling (FR-009), opening a project file from the operating system (FR-002 notes), showing the file list before a publish uploads (8.4), replacing the access token (FR-191 notes). | None | |
| D-017 | Revision history dates for versions 0.2, 0.3 and 1.0 corrected from 2026-11-21 to 2026-11-20. | Section 13 | |

No requirement number was added, changed or reused in 1.2.

### 9.8 Stakeholder answers applied in version 1.3

These answers arrived after version 1.2 was written. They are recorded in `DECISIONS.md`. D-021 is not applied: D-023 replaced it. The rows of Section 9.7 are left as the record of what was known at the time, with a pointer here where an answer changed.

| # | Answer | Requirement text changed | Also touched |
|---|--------|--------------------------|--------------|
| D-013 | Confirmed ("Correct"): position and size follow the master only between variants of the same pixel size. Closes Q-016. | FR-079 ("across ratios" became "across pixel sizes"; the "not yet confirmed" mark is removed from the note) | Section 11, 9.7 row D-013 |
| D-020 | A variant's format can be changed both ways: image to video and video back to image. Closes Q-015. | FR-120 | FR-075 notes, workflow 5.5, Section 11, 9.7 row D-012 |
| D-022 | "All staged assets can move with the project." Reading stated to the stakeholder: every asset the project has a record of is packaged, including generated options no variant uses. A file in the assets folder that the project has no record of is not packaged. | FR-008 | glossary, 9.7 row D-011 |
| D-023 | The app asks the user's permission for any campaign delete by an agent, whoever created the campaign. FR-197 already said this. | FR-195 (delete sentence and notes) | workflow 5.7 |
| D-024 | A brief with a single subject is valid. The app must also handle briefs with two or more subjects. | FR-021 | glossary |
| D-025 | An agent can change a variant's format. The rules for agent edits apply (FR-200). It is not a destructive action. | FR-195 | 3.2, FR-120 notes |
| D-026 | Settings that applied to a variant as a video are kept when it is changed to an image and later back to a video. | FR-120 | workflow 5.5, 6.1 Variant |
| D-027 | When a linked file is missing, "Package project" refuses unless the user confirms skipping the missing files. | FR-008 notes | FR-009 notes |

Wording corrected in 1.3 with no change of decision (SPEC.md Section 15, OI-19):

| Text | Correction |
|------|------------|
| FR-196 | Now names the readiness checks (FR-116) as well as the brand and legal checks, in line with FR-114. |
| FR-112 notes | Now says the requirement is not built in this build and that the assessment (OI-01) is due after this build. |
| FR-079 | "Across ratios" became "across pixel sizes" (listed under D-013 above). |

The other wordings listed in OI-19 were already corrected in 1.2: FR-195 and workflow 5.7 "can be undone" (D-010), the token exception in FR-173, 1.4 and 8.4 (D-014), the FR-075 notes on format change (D-012), and the README exception in 1.3 and 8.7 (D-015).

No requirement number was added, changed or reused in 1.3.

### 9.9 Navigation, parallel work and the window default (version 1.4)

The stakeholder gave two decisions after version 1.3, recorded in `DECISIONS.md`. D-028 came from feedback on prototype round 1. It was held back until the stakeholder had tried the new layout in prototype round 2, which they then accepted: "Navigation layout feels MUCH better". D-031 is the window default. D-029 (visual character), D-030 and D-032 change no requirement and are not applied here.

| # | Decision | Requirement text changed | Also touched |
|---|----------|--------------------------|--------------|
| D-028 | Navigation: the main tabs are open campaigns. Inside a campaign there are variant tabs. Switching project stays possible inside one running app but is the less common action. Projects are no longer tabs. | FR-003 (rewritten), new FR-211, FR-212, FR-213, FR-214 | 3.1, 6.1 Open tabs, 8.3, 8.6, 8.9 (Project switcher, Campaign tabs, Campaign view, Editor), FR-201 notes, glossary |
| D-028 | Parallel work is the design principle: the user works on several campaigns and variants at once, especially while a generation runs. | New FR-210, FR-215, FR-216, FR-217, FR-218. FR-152 (one list across all open campaigns) | 1.3, 1.4, FR-063 notes, FR-065 notes, FR-124 notes, workflow 5.1, workflow 5.5, new workflow 5.8, 6.1 Job, 8.1, 8.9 (Panels and dialogs, Activity panel), A-08, A-09, glossary |
| D-031 | The app window opens maximized, not full screen. | New FR-220 | 8.9, Section 11 (Q-036) |

The designer listed what the prototype shows that the requirements did not cover (`design/NOTES.md`, "Spec gaps"). Rulings for the gaps that belong to the accepted navigation:

| Gap | What the prototype shows | Ruling in 1.4 |
|-----|--------------------------|---------------|
| G-11 | Campaign tabs replace project tabs. One project per window with a switcher. | Requirement: FR-003, FR-211. "One project per window" is not decided (Q-038). |
| G-12 | Variant tabs inside a campaign, several open at once, each keeping its selected layer. | Requirement: FR-212, FR-213. Remembering tabs between sessions is not decided (Q-040). |
| G-13 | "Open in a tab, stay on the grid." | Requirement at P1: FR-214. What a plain click does is not decided (Q-041). |
| G-14 | A job knows its campaign, variant and layer, and has a "finished, not looked at yet" state shown on tabs, in Activity and in a message. | Requirement: FR-217, FR-218. The message at the moment of finishing is left to the design. Other tab signals are not decided (Q-042). |
| G-15 | A generation keeps running after its dialog is closed, and its options can be reopened later. | Requirement: FR-215, FR-216. What happens on a project switch or close is not decided (Q-039). |
| G-16 | Activity lists jobs from every open campaign together. | Requirement: FR-152. |

Not applied in 1.4, because the stakeholder has not decided them: G-1 to G-10 (Q-026 in `DECISIONS.md`), and G-17 to G-20 (several picture layers, cut-outs, "Choose from library", extra text layers, the wording of the agent-delete switch; Q-032 covers the first of these). Fonts, colours and other visual choices (D-029) are not requirements in this document.

Parts of the new requirements that are the analyst's reading, not the stakeholder's words. They are listed in Section 10.1 and are the first place to look if something seems wrong:

| Text | Reading |
|------|---------|
| FR-215 | Closing a campaign tab or a variant tab does not stop a generation. A second generation can be started while one runs (A-08). |
| FR-152 | A job stays in the activity panel after the tab of its campaign or variant is closed (A-09). |
| FR-214 | Priority P1. |
| 8.1, 8.3, 8.6 | The added lines on switching speed, more tabs than fit, and tab marks for accessibility follow from the principle and from the existing accessibility standard. The stakeholder did not state them. |

New requirement numbers in 1.4: FR-210 to FR-218 (new Section 4.19) and FR-220 (new Section 4.20). FR-219 is not used. FR-003 and FR-152 keep their numbers with changed text. No number was reused. New workflow: 5.8. New open questions: Q-038 to Q-042.

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-20 | Requirements Analyst | Work-in-progress draft with open questions and assumed answers |
| 0.2 | 2026-11-20 | Requirements Analyst | Open questions resolved. Added directions with one master each, variant short IDs, fan-out fit dialog, non-destructive background transforms, multi-clip background track, colour palette check, copyable rule sets, tabs, autosave, platforms, local log, licence intent. Priorities confirmed. |
| 0.3 | 2026-11-20 | Requirements Analyst | Added MCP server for external agent control (4.18, workflow 5.7). Starter template defined. No maximum video duration. Per-run provider choice. Generation details embedded in generated asset files. Custom ratios, copy generation, generation count, keyboard shortcuts and activity panel raised to P0. |
| 1.0 | 2026-11-20 | Requirements Analyst | Approved by the stakeholder. Agent export and publish confirmed as deferred. Agent assumptions and the published-prompt default moved to confirmed. |
| 1.1 | 2026-11-20 | Requirements Analyst | Brought in line with the requirement changes agreed during architecture (SPEC.md Section 0, R-01 to R-19). See Section 9.6 for the full map. Product named Adman. A project is now a single file that links to its assets, with an assets folder and a "Package project" command (FR-001, new FR-007, FR-008, FR-009). Import links by default (FR-052). Two libraries (FR-054, FR-055). Per-language word lists and a changed required-words check (FR-033, FR-113). "Present and visible" defined (FR-110). Readiness checks at export (FR-114, FR-115, new FR-116). Undo lists per variant and per campaign (FR-095). MCP access token (FR-191), agent asset list (FR-192), agent campaign creation without a form (FR-195). Saved keys cannot be viewed (FR-173). S3 and Dropbox both required (FR-160). Unsigned installers (8.7). GSAP not used (9.1). Licence chosen (9.3). Open items OI-02, OI-03 and OI-05 closed; OI-01 and OI-04 updated. Closes SPEC.md OI-13. |
| 1.2 | 2026-11-20 | Requirements Analyst | Applied the stakeholder's answers to the questions raised on 1.1 (DECISIONS.md D-010 to D-017). See Section 9.7 for the full map. An agent-created campaign is deleted, not undone (FR-195, FR-200, workflow 5.7, 9.6 row R-01). "Package project" includes everything related to the project (FR-008). An image variant can be changed to a video variant (FR-120, FR-075 notes). Position and size follow only at the same pixel size, reading not yet confirmed (FR-079 notes). The agent access token can be viewed and copied; provider and storage keys still cannot (FR-173, FR-191, 1.4, 8.4). README allowed for the first launch of an unsigned app (1.3, 8.7). Dates of versions 0.2, 0.3 and 1.0 corrected from 2026-11-21 to 2026-11-20. Open questions Q-011, Q-015 and Q-016 added to Section 11. No requirement number added or changed. |
| 1.3 | 2026-11-20 | Requirements Analyst | Applied the stakeholder's answers that arrived after 1.2 (DECISIONS.md D-013 as confirmed, D-020, D-022 to D-027; D-021 is superseded and not applied). See Section 9.8 for the full map. A variant's format can be changed both ways, and video settings survive a change to image and back (FR-120, FR-075 notes, workflow 5.5, 6.1 Variant). An agent can change a variant's format (FR-195, 3.2). Permission is needed for every agent campaign delete, including a campaign the agent created (FR-195, workflow 5.7). The same-pixel-size rule is confirmed and FR-079 now says "across pixel sizes". A brief with one subject is valid (FR-021, glossary). "Package project" takes every asset the project has a record of, leaves out files it has no record of, and needs the user's confirmation to skip missing linked files (FR-008, FR-009 notes, glossary). Stale wording corrected in FR-196 and the FR-112 notes (SPEC.md OI-19). Q-015 and Q-016 closed; Q-019 added to Section 11. Closes SPEC.md OI-19. No requirement number added or changed. |
| 1.4 | 2026-11-20 | Requirements Analyst | Applied D-028 (navigation and parallel work, accepted in prototype round 2) and D-031 (window default). See Section 9.9 for the full map. Projects are no longer tabs: the user switches project inside the running app (FR-003 rewritten). New Section 4.19: parallel work as the principle (FR-210), campaign tabs (FR-211), variant tabs (FR-212), every tab keeps its place (FR-213), opening a variant without leaving the overview (FR-214, P1), a generation continues when its dialog is closed (FR-215), its result can be reopened later (FR-216), every generation shows its campaign, variant and layer (FR-217), running and "finished, not yet looked at" are visible from anywhere in the project (FR-218). The activity panel is one list across all open campaigns (FR-152). New Section 4.20: the window opens maximized, not full screen (FR-220). New workflow 5.8. Notes added to FR-063, FR-065, FR-124 and FR-201. Also touched: 1.3, 1.4, 3.1, workflows 5.1 and 5.5, 6.1 (Job, Open tabs), 8.1, 8.3, 8.6, 8.9, glossary. Assumptions A-08 and A-09 added. Open questions Q-036 and Q-038 to Q-042 added to Section 11. Prototype gaps G-11 to G-16 ruled; G-1 to G-10 and G-17 to G-20 not applied. |
