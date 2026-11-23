# requirements/draft-client-input.md

**Project:** Adman
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** Draft for the stakeholder. Nothing here is in `REQUIREMENTS.md` yet.
**Read against:** `REQUIREMENTS.md` 1.4, `SPEC.md` 1.7, `DECISIONS.md` D-001 to D-038.

## What this file is

Two client reviewers answered the questions in `client/QUESTIONS.md`: a manager (`client/MANAGER.md`) and a creative (`client/CREATIVE.md`). Their answers are advice, not decisions (D-034). This file splits their answers into single points and gives each point one status, using the stakeholder's rule:

> "let's automatically accept anything which is relatively easy to implement. Anything which contradicts already scoped features should require my input."

| Status | Meaning |
|--------|---------|
| ALREADY COVERED | The documents already answer the point. The answer can be "yes, it does this" or "no, and this was decided". |
| ACCEPTED (easy) | Small, fits the design, contradicts nothing in scope. Written below as a proposed requirement. |
| NEEDS STAKEHOLDER | Changes or contradicts something scoped or decided, is on the out-of-scope list, bears on a question that is already open, or is not small. |
| NOT A REQUIREMENT | A matter for the client's own organisation (billing, IT, legal). |
| DESIGNER | A choice of type, colour, label or sample content. Goes to the design track (round 3, Q-043), not into functional requirements. |

When a point sat between ACCEPTED and NEEDS STAKEHOLDER, it went to NEEDS STAKEHOLDER.

---

## 1. Summary counts

| Status | Manager | Creative | Total |
|--------|---------|----------|-------|
| ALREADY COVERED | 21 | 10 | 31 |
| ACCEPTED (easy) | 13 | 8 | 21 |
| NEEDS STAKEHOLDER | 11 | 13 | 24 |
| NOT A REQUIREMENT | 6 | 0 | 6 |
| DESIGNER | 0 | 8 | 8 |
| **Total points** | **51** | **39** | **90** |

- The 21 accepted points become 20 entries, FR-230 to FR-249: 17 new requirements and 3 additions to existing ones (FR-240 to FR-113, FR-243 to FR-214, FR-249 to FR-093). See Section 2.
- The 24 points that need the stakeholder fold into 17 questions, S-1 to S-17. See Section 3.
- Three accepted entries touch the Phase 2 frozen contracts. They are marked **FLAG** in Section 2 and listed in Section 2.1. They are cheapest if decided before Phase 2 step 0, which has not started.

---

## 2. ACCEPTED: proposed requirements, ready to apply

New numbers start at FR-230. All are P1 unless stated, because they come from review and not from the original brief. "Phase" is the build phase in `SPEC.md` Section 14.

### Cost

**FR-230:** For each campaign the app shows the total number of paid generations used so far, split into pictures and videos. The total counts every generation sent to a paid provider for that campaign, including runs whose options were never picked. The user can see it in the campaign view and on the confirmation dialog before a run (FR-064). Each export report states the campaign's total at the time of the export (FR-150).
**Priority:** P1
**Phase:** 4 (count and display), 8 (line in the report)
**Notes:** It is a count of generations, not an amount of money. The app does not know the client's prices.
**Why easy:** every job record already holds its campaign and what was asked for. This is a sum over records the app keeps anyway.
**Source:** manager M-3.

### Export report

**FR-231:** The report starts with a short summary: how many ads were exported, how many passed every check, how many have warnings, and how many failed to export. Directly under it the report lists every warning the user chose to export past, before any per-ad detail.
**Priority:** P1 **Phase:** 8
**Why easy:** the report already holds every check result. This is a count and an ordering.
**Source:** manager M-1 ("as long as the approver sees it plainly"), M-4.

**FR-232:** The report states what the campaign asked for against what this export delivered. It lists each combination of size and language from the campaign's lists (FR-031) that has no exported ad, with the reason: no variant exists, the variant was not part of this export, or the export of it failed.
**Priority:** P1 **Phase:** 8
**Why easy:** the campaign's sizes and languages and the list of exported variants are both already known at export time.
**Source:** manager M-4.

**FR-233:** For each ad the readable report shows a small picture of it. For a video ad the picture is one still frame. The report stays one file that opens without the app.
**Priority:** P1 **Phase:** 8
**Why easy:** the app already draws small pictures of every variant for the grid.
**Source:** manager M-4.

**FR-234:** The report header names the campaign's market (its region, FR-030), its audience, the campaign ID, the date and time of the export, the name of the person who exported (FR-235), and which export of this campaign it is (first, second and so on). Each ad's entry names its subjects by ID and by display name, its size, language and format.
**Priority:** P1 **Phase:** 8
**Notes:** The app has no "brand" field. The brand is whatever the campaign name and subject names say. A brand field would be a new request.
**Why easy:** every value is already stored. The export number is a count of the campaign's earlier reports.
**Source:** manager M-4.

**FR-235:** Settings has an optional field "Name shown in reports". The app writes it into each report as the person who exported. If it is empty the report says "name not set". The report says that the name is typed by the user and is not checked.
**Priority:** P1 **Phase:** 8
**Notes:** This is a label, not a login. Login stays out of scope (Section 1.4). It adds one value to the app's settings, which were built in Phase 1.
**Why easy:** one text field and one line in the report.
**Source:** manager M-4 ("The app has no login. Whose name goes in the report?").

**FR-236:** When the user chooses to export past warnings (FR-115), the dialog offers a field for the reason. The reason is optional. For each warning exported past, the report shows who proceeded (FR-235), when, and the reason given, or "no reason given".
**Priority:** P1 **Phase:** 8
**Why easy:** the decision to proceed is already recorded. This adds one text value to it.
**Source:** manager M-4.

**FR-237:** For each ad that is not in the campaign's main language, the report shows where its translation came from (AI, an agent, typed by the user, or supplied with the brief) and whether it is approved.
**Priority:** P1 **Phase:** 8
**Notes:** "Approved" means approved in the app by its user (FR-101). The app does not know whether that person is a native speaker. See S-6.
**Why easy:** both values are already stored on every translated text layer.
**Source:** manager M-4.

**FR-238:** From the second export of a campaign onward, the report marks each ad as changed or not changed since the previous export of that campaign.
**Priority:** P1 **Phase:** 8
**Notes:** This is what tells an approver that an earlier sign-off no longer holds. It covers changes by a person and by an agent alike.
**Why easy:** every variant already has a change counter. The report only has to remember the counter's value.
**Source:** manager M-5.

**FR-239:** The app records, per variant, the last time an agent changed it. The report shows this for each ad: "last changed by an agent on (date)" or "no agent changes".
**Priority:** P1 **Phase:** 2 (the stored value), 10 (written when an agent edits), 8 (shown in the report)
**Notes:** The local log already marks agent actions (FR-200), but the log is not part of the project and does not travel with it.
**Why easy:** one stored date per variant. **FLAG:** it adds a value to the variant record, which is one of the Phase 2 frozen contracts.
**Source:** manager M-5 ("Does the report show which changes an agent made?").

### Checks

**FR-240 (addition to the notes of FR-113):** "An entry in a prohibited list that consists only of punctuation or symbols (for example `!`) is matched wherever it appears in a text layer."
**Priority:** P0, as FR-113 **Phase:** 6
**Notes:** This gives "no exclamation marks". It applies to every text layer, not to headlines only. A rule limited to headlines is part of S-1.
**Why easy:** a small addition to the matching rule. No new data.
**Source:** manager M-1.

### Publishing

**FR-241:** Every publish writes the date and time of the publish, and which publish of this campaign it is, at the top of the published report. The warning shown before a publish replaces earlier files (FR-164) also says that someone may be reviewing the files being replaced.
**Priority:** P1 **Phase:** 9
**Notes:** Earlier files are still replaced (FR-164 is unchanged). Keeping earlier versions side by side would contradict FR-164 and is not proposed.
**Why easy:** the publish already writes a file list with a time. The count comes from the list it replaces.
**Source:** manager M-7.

### Navigation

**FR-242:** The user can go to the next and to the previous variant tab, and to the next and to the previous campaign tab, from the keyboard.
**Priority:** P1 **Phase:** 3 (first phase with real variant tabs)
**Notes:** Which keys is for the design. Fits Section 8.6, which already requires every control to be reachable by keyboard.
**Why easy:** two pairs of shortcuts on tabs that already exist.
**Source:** creative C-1.

**FR-243 (addition to FR-214):** Holding Cmd on macOS, or Ctrl on Windows, while clicking a tile opens that variant in a tab without leaving the overview.
**Priority:** P1, as FR-214 **Phase:** 5
**Notes:** Holds whatever Q-041 decides for a plain click.
**Why easy:** a second way to trigger an action FR-214 already requires.
**Source:** creative C-2.

**FR-244:** From the overview the user can look at one variant large without opening a tab ("quick look"), and can step to the next and previous variant while it is open. Closing it returns to the overview as it was.
**Priority:** P2 **Phase:** 5
**Notes:** The key (the creative suggests the space bar) is for the design. View only: nothing can be edited there.
**Why easy:** it shows a picture the app can already draw. Nothing is stored.
**Source:** creative C-2.

### Import and editing

**FR-245:** An imported picture with a transparent background keeps its transparency in the editor, in the grid pictures and in the exported ad.
**Priority:** P0 (a statement of expected behaviour, not a new feature) **Phase:** 3
**Notes:** This lets a user bring in a product cut-out made in another tool. Making a cut-out inside the app is a separate, open question (S-12).
**Why easy:** the way the app draws pictures already supports it. The requirement makes it a tested promise.
**Source:** creative C-7.

**FR-246:** The user can import files by dragging them onto the app window. The same import choices are offered as for any import (FR-052, FR-054).
**Priority:** P1 **Phase:** 2 (with the import dialog)
**Why easy:** a second way into the existing import.
**Source:** creative C-8.

**FR-247:** 4:5 (1080×1350) is offered as a ready-made size wherever the user picks a campaign's sizes (FR-026, FR-032). It is not selected by default. The defaults stay 1:1, 9:16 and 16:9.
**Priority:** P1 **Phase:** 2
**Notes:** 4:5 is already possible as a custom size (FR-032). This only saves typing it.
**Why easy:** one more entry in a list. **FLAG:** if the folder for it should be named `4x5` and not `1080x1350`, the size-label rule in the Phase 2 frozen contracts gains one value.
**Source:** creative C-10.

**FR-248:** For any layer that has been generated into, the user can see the options from earlier runs for that layer and pick one of them. Picking an earlier option uses no new generation.
**Priority:** P1 **Phase:** 4
**Notes:** The files are already kept: options that were not picked stay in the project (FR-216 notes, FR-008). What is new is a way to find them from the layer, not only in the asset library.
**Why easy:** the files and the run they came from are already recorded. This is a list.
**Source:** creative C-10.

**FR-249 (addition to FR-093):** Text properties also include letter spacing (tracking). It follows the master as part of style (FR-079). A change to it re-checks whether the text fits its box (FR-098).
**Priority:** P1 **Phase:** 3
**Why easy:** one more number on a text layer, drawn by a standard setting. **FLAG:** it adds a field to the text style, which is one of the Phase 2 frozen contracts.
**Source:** creative C-10.

### 2.1 Accepted entries that touch the Phase 2 frozen contracts or the data model

| Requirement | What it touches | When it must be decided |
|-------------|-----------------|-------------------------|
| FR-239 agent-change date | One new stored value on the variant record (frozen row schema, first migration) | Before Phase 2 step 0 |
| FR-249 letter spacing | One new field in the text style (frozen `layer.ts`) | Before Phase 2 step 0 |
| FR-247 4:5 preset | Possibly one new size label, `4x5` (size-label rule, slice B's size parser) | Before Phase 2 step 0 |
| FR-235 report name | One new value in the app's settings (built in Phase 1, not a Phase 2 contract) | Before Phase 8 |
| FR-230 to FR-238 | New fields in the report's content (SPEC 6.7, built in Phase 8). FR-236 adds a reason to the export action. FR-238 stores each variant's change counter in the report. | Before Phase 8 |
| FR-248 earlier options | Relies on a job recording its layer, which FR-217 already requires and the spec has not added yet | Architect's navigation pass |

If the stakeholder would rather not open the frozen contracts, FR-239, FR-247 (label only) and FR-249 move to Section 3.

---

## 3. NEEDS STAKEHOLDER: questions, each with a recommendation

**S-1. More brand and legal checks.** The manager asks for checks beyond the four that are scoped (FR-110, FR-111, FR-113): the typeface, claims that need legal sign-off, "free" needing offer terms, logo clear space, and punctuation rules for headlines only. *Conflict:* each needs new content in the rule set (FR-033), which is part of the Phase 2 frozen contracts. *Size:* small each for the first three, medium for clear space. *Recommendation:* accept three now, before Phase 2 step 0: (a) an allowed-fonts list, with a check that every text layer uses one of them; (b) a "claims" word list per language, where a match is not a failure but is listed in the report as "needs legal sign-off"; (c) a "word A needs word B" rule. Defer logo clear space and headline-only rules.

**S-2. Approvals.** The manager says approvals are 6 of 15 days and that without a change there "leadership will not see this as meeting the 5-day target". *Conflict:* "Approval workflows inside the app" and "Share links" are out of scope (Section 1.4, A-05). *Size:* large. *Recommendation:* keep out of scope. Answer the client that the app shortens approval indirectly: checks run before an approver sees anything, and the report (FR-231 to FR-238) is written for approvers. See also S-16.

**S-3. The client's figures.** The manager supplied measures: 15 days brief to launch (target 5), 300 campaigns a month (target 450), 20% of assets sent back, click-through 0.9% (target 1.2%). *Conflict:* Section 1.3 says the stakeholder set no measurable targets. *Size:* small (text only). *Recommendation:* record them in Section 1.3 as the client's reference figures, not as targets for this build. The app measures none of them.

**S-4. A limit on paid generations per campaign.** *Conflict:* none in scope, but it adds a stored value to the campaign record (Phase 2 frozen contract), and the manager ties agent spending to it ("keep it that way until we have cost limits", OI-06). *Size:* small. *Recommendation:* accept as a soft limit: the user sets a number per campaign, and the run dialog warns when a run would pass it. The user can still proceed. A hard stop is not recommended in a single-user app.

**S-5. Total spend across 14 designers and 6 agencies in one place.** *Conflict:* needs accounts or a shared service. Login and telemetry are out of scope (Section 1.4). *Size:* large. *Recommendation:* no. The per-campaign count in each report's data file (FR-230) can be added up outside the app.

**S-6. Naming the native speaker who reviewed a translation.** The client's rule is a native-speaker review for every market. *Conflict:* the app has one user and no reviewer role. Importing a corrected translation sheet is out of scope. *Size:* small (a typed "reviewed by" name per language) but it adds stored data. *Recommendation:* defer. FR-237 shows source and approval. The review itself happens on the exported sheet (FR-103).

**S-7. Should an agent ask before deleting a layer?** The manager wants a person in the loop for "deleting anything". *Conflict:* accepted decision C-20 and FR-197: a layer delete by an agent is an ordinary edit, with no prompt, and can be undone. *Size:* small. *Recommendation:* keep as decided. Campaign and variant deletes already ask.

**S-8. Which copy of a project is current?** *Conflict:* two people working on one campaign is out of scope (Section 1.4, A-02). The app cannot tell copies apart (see also Q-034). *Size:* a real answer is large. *Recommendation:* keep out of scope. One small aid, if wanted: "Package project" writes a short readable note into the folder with the project name, the date packaged and the name from FR-235.

**S-9. Market in the folder or file name.** The manager routes by market, and two markets can share a language. *Conflict:* changes the documented layout in FR-142, FR-163 and SPEC 6.5 and 6.7. A campaign already has exactly one market (FR-030), but its folder name does not say which. *Size:* small. *Recommendation:* yes. Add a short market code to each file name, for example `{language}-{market}-{variant id}`. The market is free text today, so the app needs a rule for turning it into a short code.

**S-10. Client advice on Q-041 (what a plain click on a tile does).** The creative says: keep click = go to the variant, keep the "+" control for opening behind. *Recommendation:* take the advice and close Q-041. FR-243 adds Cmd-click either way.

**S-11. Client advice on Q-042 (warnings on tabs).** The creative says: yes, but one mark only, "needs your attention", with "out of date" as the case that matters most. Do not repeat the full badge list on tabs. *Conflict:* FR-218 requires only "running" and "finished, not yet looked at". *Size:* small. *Recommendation:* accept: one extra mark on a variant tab and its campaign tab, shown when a variant is out of date. Decide whether check warnings and missing files also raise it.

**S-12. Client advice on Q-032 (several picture layers and cut-outs).** The creative says: would use several picture layers; cut-outs are needed for real work ("a product on a ground is the base case"), which points to option B; packs with lettering imported, not generated, is acceptable and preferred (sub-question 4); extra hand work per size is acceptable only if fan-out gives a usable first pass (sub-question 8). The creative also asks for: a shadow under a cut-out, checking a generated cut-out's edge at full size before accepting it, and generation that sees the rest of the ad so light and colour match. *Conflict:* Q-032 is undecided; cut-outs may need a second paid service (sub-question 3); a shadow is close to "filters" and "text effects", which are out of scope. *Size:* medium to large. *Recommendation:* decide Q-032 with this advice in hand. The architect recommended option A now and B at the start of Phase 4. FR-245 already lets a user import a cut-out made elsewhere, which covers the base case meanwhile.

**S-13. Lookalike product packs in generated pictures.** The creative wants a way to stop or flag them. The manager states "our packaging may not be altered or redrawn". *Conflict:* FR-055, second case: when a subject has only reference files, they are sent to the picture model "to build a new scene", which draws the product. *Size:* small for a switch, large for automatic detection. *Recommendation:* add a switch per subject, "never draw this subject". When it is on, the app does not offer the second case of FR-055 for that subject, tells the model to leave the product out, and the report marks any generated picture that used that subject's files as reference. No automatic detection.

**S-14. Layout help across sizes.** The creative asks for pinning a layer to a corner or to another layer, and for seeing all sizes side by side while adjusting one. *Conflict:* pinning changes how position is stored and how fan-out places layers (FR-079, a frozen contract). *Size:* medium each. *Recommendation:* defer both. FR-244 (quick look) gives part of the side-by-side need.

**S-15. Safe zones on 9:16.** *Conflict:* "safe-zone overlays" is on the out-of-scope list (Section 1.4). The creative ranks this second of the things that would stop real use. *Size:* small for a guide the user can switch on in the editor, never exported; medium if it is also a check. *Recommendation:* accept the guide only, in Phase 3, with one fixed top and bottom margin for 9:16.

**S-16. A contact sheet before export.** The creative ranks "no way to get approval before export" third. *Conflict:* a link with comments is an approval workflow and a share link, both out of scope. A sheet alone conflicts with nothing. *Size:* small once FR-233 exists. *Recommendation:* accept the sheet only: a "review sheet" the user can save at any time, with a picture of each chosen variant, its ID and its current check results. One file, no final ads written, no link, no comments.

**S-17. Layered export (PSD or similar).** *Conflict:* not scoped. FR-141 exports PNG, JPG and MP4 only. *Size:* large for a real PSD with editable text; medium for "each layer as its own picture file". *Recommendation:* no for this build. Published campaigns already include the separate components (FR-162).

---

## 4. ALREADY COVERED: answers to send back

### 4.1 To the manager

| Point | Answer | Where |
|-------|--------|-------|
| M-1. Hand resizing and localizing | Removed. One master ad produces the grid of sizes and languages, and a change to the master is reviewed and applied in one step. | FR-075, FR-082, FR-100 |
| M-1. Which rules the checks cover today | Four: required assets such as the logo are present and visible; every text colour is from the palette; no prohibited word; every required word. Word lists are per language. Two readiness checks are added: unapproved translations and text that does not fit. Not covered: clear space, typeface, claims, conditional rules (S-1). | FR-110, FR-111, FR-113, FR-116 |
| M-1. Finding files | Exports and published folders are organized by campaign, post and size, with language and variant ID in the file name. Market: see S-9. | FR-142, FR-163 |
| M-2. Does the variant ID stay with the ad? | Yes. Each variant has a short ID that never changes. It is in the file name, the report and the translation sheet. Two cautions: it is unique inside one project, so match on campaign ID plus variant ID; and it lives in the file name only, so it is lost if a platform renames the file on upload. | FR-070, FR-142; SPEC 3.2 |
| M-4. Each check and its result, in plain words | Yes. | FR-150, FR-151 |
| M-4. Generated or imported, per picture | Yes. The report lists every picture in every ad as generated (with provider, model and prompt) or imported. "Imported" means the file came from the user. The app cannot prove it is a photograph. See S-13. | FR-150; SPEC 6.7 |
| M-4. Campaign ID and export date | Yes. Exporter's name and export number are added by FR-234 and FR-235. | FR-150 |
| M-4. Readable by a non-technical person | Yes. The report is saved as a readable file and as a data file. | FR-151 |
| M-5. Approving the master before variants | The user makes the master first and starts fan-out as a separate step. There is no sign-off by a second person (S-2). | FR-065, FR-075 |
| M-5. Approving every translation | Yes, whatever its source. An agent can supply a translation but cannot approve one. | FR-101, FR-200 |
| M-5. Anything that spends money | An agent cannot start paid generation, export or publish in this build. Whether that changes later is open (OI-06). | FR-199 |
| M-5. Overriding a failed check | An agent cannot export, so it can never export past a warning. | FR-199, FR-115 |
| M-5. Changing the rule set | An agent can read rule sets and cannot change them. One exception to know about: when an agent creates a new campaign it can supply that campaign's first rule set. | FR-192; SPEC 4.5, 5.2 |
| M-6. Studio to agency handover | "Package project" gathers the project and all its files into one folder. | FR-008 |
| M-6. A shared place for approvers | Publishing puts finished ads, the report and the translation sheet in cloud storage, browsable without the app. Publishing is a manual step, so the folder is as current as the last publish. FR-241 shows when that was. | FR-161 to FR-164 |
| M-7. Where finished ads land | Amazon S3 and Dropbox work in this build. Another service can be added later without changing the rest of the app. | FR-160, IR-001 |
| M-7. Landing is not launch | Agreed. Posting to platforms is out of scope. | Section 1.4 |
| M-8. No link to performance | Out of scope, as you note. The variant ID is the hook for matching results later. | Section 1.4 |
| M-8. Right-to-left languages | Not supported in this build. Please confirm whether any of the 22 markets needs one. | FR-104 |
| M-8. Japanese | Supported. It can use its own font, word checks work without spaces between words, and text that does not fit is flagged, never shrunk silently. | FR-056, FR-098; SPEC 6.9 |
| M-8. Halden Sans | Yes, if you supply the font file and hold a licence for it. It is uploaded once per project and used on any text layer. Making it the only allowed font is S-1. | FR-051, FR-056 |

### 4.2 To the creative

| Point | Answer | Where |
|-------|--------|-------|
| C-1. Two rows of tabs | Matches the accepted navigation. No change. | FR-211, FR-212 |
| C-1. Eight or more variant tabs | The navigation must stay usable when there are more tabs than fit. | Section 8.3 |
| C-1. A spinner does not say what is running | The activity panel names the campaign, variant and layer of each job and leads there in one action. | FR-152, FR-217 |
| C-8. The product layer stays untouched | The app never alters an imported file. Crop and scale are stored settings, and generated fill is applied only where the user asks. | FR-077, FR-055 |
| C-9. Hand adjustments survive a sync | Yes. Position and size do not follow the master across sizes, and anything overridden is skipped by a sync and shown for a decision. | FR-079, FR-083 |
| C-10. Custom sizes | Yes, any ratio or pixel size per campaign. 4:5 becomes a ready-made choice with FR-247. | FR-032 |
| C-10. The client's own fonts | Yes. Font files can be uploaded and used on text layers. | FR-051, FR-056 |
| C-10. A size override per language | Yes, per variant: a linked text layer can override its size. There is no single step that applies one override to every variant of a language. | FR-080 |
| C-10. A mandatory legal line | As a check: a campaign's required words can hold a whole phrase per language, and a missing one is warned about before export. A campaign has one market, so the rule is per market. The app does not add the line to the ad by itself. | FR-033, FR-113 |
| C-10. Dragging, snapping, guides | In scope. The prototype left them out. | FR-092, FR-096 |

---

## 5. NOT A REQUIREMENT: for the client's organisation

| Point | Note |
|-------|------|
| M-2. Current cost per asset | The client confirms. FR-230 supplies the generation count. |
| M-3. Who pays for each key, and how it is billed | Finance. The app accepts any key, so a company key works (A-04). |
| M-8. Unsigned app on company laptops | IT security. Signed installers are out of scope for this build (Section 1.4, 8.7). A wider rollout would need them. |
| M-8. Company accounts for the picture and video services | Procurement and IT. |
| M-8. Which outside services may receive briefs and product pictures | Legal and IT. Section 6.3 states what is sent and where. |
| M-8. Legal position on generated pictures in ads | Legal. |

Client to confirm, as raised by the manager: which cloud storage service IT allows; whether any market needs a right-to-left language; current cost per asset.

---

## 6. DESIGNER: for round 3 and Q-043

| Point | Reviewer's advice |
|-------|-------------------|
| C-1. Tab labels | Too long. Drop the direction name when a campaign has one direction. |
| C-4. Sample looks | Poolside is closest to real work. Field notes is the most distinctive. Night market is the weakest. |
| C-4. Photo-led sample | All three looks are flat illustration; real work is mostly photography. D-038 already queues photos for round 3. |
| C-4. Field notes | Its captions with arrows break when the layout changes per size. |
| C-5. Type | Default serif reads well. Serif for titles, briefs, prompts and copy fields. Sans for anything that reports a problem. |
| C-6. Spot colour | Magenta. With vermilion the Export button sits too close to the error red. |
| C-6. Selection outline | It uses the spot colour and vanishes against artwork of that colour. Use something that survives any artwork, for example a light and dark double line. |
| C-10. IDs on tiles | Noise. Move them to a tooltip. The ID must stay easy to find elsewhere (file name, report), because the manager matches on it. |

---

## 7. Pending change to REQUIREMENTS.md: FR-215 (D-036 item 4)

**Decision:** D-036 item 4. Generative fill, layout proposals, copy options and translation do NOT keep running in the background. If one is in progress and the user tries to close the tab, the app warns the user. The stakeholder's words: "No if those tasks are open and the user tries to close the tab we can warn the user".

**Orchestrator's reading, stated to the stakeholder:** confirming the warning stops the task, and the same warning applies to closing that task's dialog.

**To apply later, by someone with an edit tool.** Replace FR-215 and its notes with the text below. Keep the "Added in 1.4" line and add the "Changed" line.

> **FR-215:** A picture generation or a video generation the user has started keeps running when the user closes its dialog or panel, goes to another variant or campaign, closes the tab of its variant or campaign, or opens Settings. While it runs the user can do any other work in the project, including starting another generation for a different variant.
>
> Generate fill, layout proposals, copy options and translation are different. They do not keep running in the background. If one of them is in progress and the user tries to close its dialog, or the tab of the variant or campaign it belongs to, the app warns the user that the task is in progress. If the user confirms, the task stops and the dialog or tab closes. If the user cancels, nothing closes and the task carries on.
> **Priority:** P0
> **Notes:**
> - The first paragraph applies to image generation (FR-060 to FR-065) and to video generation (FR-123, FR-124). FR-124 already said it for video.
> - The second paragraph applies to generate fill (FR-076), layout proposals (FR-061), copy options (FR-045) and translation (FR-101). The stakeholder's words: "No if those tasks are open and the user tries to close the tab we can warn the user".
> - Two parts of the second paragraph are the orchestrator's reading, stated to the stakeholder and not yet confirmed in their words: that confirming the warning stops the task, and that the same warning applies to closing the task's own dialog.
> - While one of these four tasks is in progress the user can still go to another tab and work there, as long as the task's dialog and tab stay open (FR-210, 8.1). This is the analyst's reading.
> - A task stopped this way leaves the variant as it was before the task started. The warning says so. It also says that a stopped task may already have used a paid call.
> - How many generations run at the same moment, and whether later ones wait in a queue, is for the spec. The user must be able to start them without waiting for an earlier one.
> - Not decided: what happens to a running generation when the user switches to another project or closes the project (Q-039). This requirement covers work inside the open project.
> - The stakeholder confirmed that closing a tab does not stop a picture or video generation, and that a second generation can be started while one runs (D-036 item 1).
> **Added in 1.4:** D-028. Prototype gap G-15.
> **Changed in 1.5:** D-036. The four shorter AI tasks do not run in the background and closing their tab or dialog warns the user. Before, whether each survived the closing of its own dialog was left to the spec.

**Other text the same edit must touch:**

- Section 10.1, A-08: confirmed by D-036 item 1; no longer an assumption. A-09: confirmed by D-036 item 2.
- Section 9.9, table of analyst's readings: remove the FR-215 and FR-152 rows, or mark them confirmed.
- Section 8.1, first line: it names image and video generation only, which is now exact. No change needed.
- Workflow 5.8 and Section 8.9 "Panels and dialogs": check that "the generation dialog can be closed while its run continues" is read as picture and video generation only, and add the warning dialog to the list of dialogs.
- FR-076 notes (generate fill at fan-out) and FR-084 (translations in the sync review): add a pointer to FR-215.
- Section 13: a revision line for 1.5.

**Two questions this change raises:**

1. Translation at fan-out runs for many variants at once and belongs to no single variant tab. Does the warning then apply to closing the campaign tab and the fan-out dialog?
2. If the user confirms and the task stops, are results that had already arrived (for example translations for some languages) kept or dropped? Recommended: kept, and shown as proposed, because they may have been paid for.

---

## 8. Open questions for the orchestrator to put to the stakeholder

1. Section 3, S-1 to S-17.
2. Do the three flagged entries (FR-239, FR-247 label, FR-249) go in before Phase 2 step 0, or wait?
3. Is P1 the right priority for the accepted entries, given that every brief feature is P0?
4. The two questions at the end of Section 7.
5. Should the answers in Sections 4 and 5 be sent back to the two reviewers as written?
