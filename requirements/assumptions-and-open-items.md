# Requirements: assumptions and open items

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 10. Assumptions

### 10.1 Assumptions not discussed with the stakeholder

| # | Assumption | Impact if Wrong |
|---|------------|-----------------|
| A-01 | Superseded in 1.1 by a stakeholder decision (R-06): each project is one file that holds its own data, and it links to asset files instead of containing them. No longer an assumption. | Not applicable. Portability now depends on "Package project" (FR-008). |
| A-02 | A project is opened by one person at a time | Shared network folders with two editors could corrupt data |
| A-03 | The user has internet access when using AI features and publishing | Offline behaviour for those features would need defining |
| A-04 | Users have their own accounts and billing with each AI provider | The app would need a way to supply or meter keys |
| A-05 | Analytics, approvals and posting to social platforms are handled by other tools | Scope would grow considerably |
| A-06 | A master variant is deleted only by deleting its whole direction | A rule for orphaned linked variants would be needed |
| A-07 | Video exports default to 30 frames per second and the user can raise it to 60 | Export settings UI would change |
| A-08 | Closing a campaign tab or a variant tab does not stop a generation that belongs to it, and the user can start a generation while another is running (FR-215). *(Added in 1.4.)* | If closing a tab should stop the run, or only one run is allowed at a time, FR-215 and FR-065 notes change and the app needs a warning before a tab closes |
| A-09 | A job stays listed in the activity panel after the tab of its campaign or variant is closed (FR-152). *(Added in 1.4.)* | The user could lose track of a result they paid for |

### 10.2 Analyst proposals accepted without comment
The stakeholder was told these would be treated as confirmed unless corrected, and did not correct them.

| # | Accepted answer | Where used |
|---|-----------------|------------|
| C-01 | The brief's cut-off sentence ("If ") held nothing that changes requirements | IR-002 |
| C-02 | Firefly is listed but disabled until it works | FR-067 |
| C-03 | Superseded in 1.1 (R-15): S3 and Dropbox must both work in this build. Azure is listed but disabled. Before: one cloud service must work first, the others follow. | FR-160 |
| C-04 | No share link after publishing | Scope |
| C-05 | Published contents as listed | FR-162 |
| C-06 | One cloud folder per campaign ID plus a warning before replacing | FR-164 |
| C-07 | Superseded in 1.1 (R-08, R-12): imported files are linked by default, with copying as a choice, and go into one of two libraries. They can still be attached to a subject. Before: imported files are copied into the project and held in a pool. | FR-052, FR-054 |
| C-08 | No other accepted file type. "Text content" means copy and brief files. | FR-051 |
| C-09 | Link properties are fixed defaults | FR-079 |
| C-10 | No user-made templates | FR-041 |
| C-11 | Briefs accept optional extra fields | FR-021 |
| C-12 | Translation only, with region and audience as context | FR-101 |
| C-13 | Checks can also be run on demand | FR-114 |
| C-14 | Failed video generation keeps the existing background and offers retry | FR-124 |
| C-15 | Default ratios and default language | FR-026 |
| C-16 | Report shown in the app and saved as a readable file and JSON | FR-151 |
| C-17 | Manual updates. README example set as described. | 8.7, FR-180 |
| C-18 | Supplying translations up front stays at P1 | FR-027 |
| C-19 | An agent works only on projects open in the app | FR-201 |
| C-20 | "Destructive" means deleting a campaign or variant. Layer deletion is an ordinary edit. An agent cannot delete subjects or assets. | FR-197 |
| C-21 | Generated components keep their embedded prompt when published to the cloud | FR-162 |

## 11. Open Items & Decisions Required

Architecture is complete. The table shows the state of each item from version 1.0 as recorded in SPEC.md Section 15. SPEC.md Section 15 continues the same numbering with items raised during architecture (OI-07 to OI-14) and is the live list.

| # | Item | Owner | Due Date |
|---|------|-------|----------|
| OI-01 | Open. Assess Jev (typesafe.ai) for image colour verification and decide whether FR-112 is built. The architect read only the introduction page and found the fit plausible. FR-112 is not built in this build. | Stakeholder, Architect | After this build |
| OI-02 | Closed. The licence is PolyForm Noncommercial 1.0.0, confirmed by the stakeholder (R-19). Bundled parts must stay compatible with it (9.3). | — | — |
| OI-03 | Closed. No route to Adobe AI products without an enterprise plan was found. Firefly is a stub only. | — | — |
| OI-04 | Open. Confirm the image-to-video provider route by testing: the Seedance model, its limits and its price on fal.ai. | Developer | Start of development Phase 7 |
| OI-05 | Closed. How generation details are embedded for each file type is decided in SPEC.md Section 6.6. | — | — |
| OI-06 | Open. Decide whether an agent may later start generation, export or publish, and under what limits | Stakeholder | After this build |

Questions open after version 1.4. They keep their numbers from `DECISIONS.md`, which is the live list of questions for the stakeholder. Q-015 and Q-016, listed here in 1.2, are answered (D-020, D-013) and removed. Q-038 to Q-042 are new in 1.4. The analyst chose the next free numbers; they are not yet entered in `DECISIONS.md`.

| # | Item | Owner | Due Date |
|---|------|-------|----------|
| Q-011 | Open. Review the wording of versions 1.1, 1.2, 1.3 and 1.4 so the status of this document can return to Approved. | Stakeholder | None set |
| Q-019 | Open. Should an agent ever be able to read the access token through the server? This document says no (8.4, FR-198), and that stays the rule until the stakeholder decides. | Stakeholder | Before development Phase 10 |
| Q-036 | Open. Window: open maximized on every launch, or only the first time and after that at the size the user last left it? Until answered: maximized on every launch (FR-220, SPEC.md OI-26). | Stakeholder | Before development Phase 11 |
| Q-038 | Open. Is one project visible per window right, or must the user be able to see two projects side by side? This also settles whether more than one project can be open in the app at once. Affects FR-003, FR-152 and FR-201. | Stakeholder | Before the navigation is built |
| Q-039 | Open. What happens to a running generation when the user switches to another project or closes the project: does it keep running, stop, or does the app ask first? And is a finished result that was never looked at still there when the project is opened again? Affects FR-003, FR-215 and FR-216. | Stakeholder | Before the navigation is built |
| Q-040 | Open. Are the open campaign tabs and variant tabs remembered the next time the project is opened? Affects FR-213. | Stakeholder | Before the navigation is built |
| Q-041 | Open. Does a plain click on a variant's tile go to the variant, or open it in a tab behind the overview? The prototype goes to the variant and has a separate control for staying. Also confirm P1 for FR-214. Affects FR-212 and FR-214. | Stakeholder | Before the navigation is built |
| Q-042 | Open. Should tabs also signal warnings such as "out of date" or a check warning, or only "running" and "finished, not yet looked at"? Affects FR-218. | Stakeholder | Before the navigation is built |
