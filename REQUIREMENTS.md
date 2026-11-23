# REQUIREMENTS.md

**Project:** Adman
**Version:** 1.4
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** In Review. Version 1.0 was Approved. Each change in 1.1 was agreed by the stakeholder during architecture (Section 9.6). Version 1.2 applies the stakeholder's answers to the questions raised on 1.1 (Section 9.7). Version 1.3 applies the answers that arrived after 1.2 (Section 9.8). Version 1.4 applies the navigation model the stakeholder accepted in the prototype, the parallel-work principle and the window default (Section 9.9). The stakeholder has not yet reviewed the full wording of 1.1, 1.2, 1.3 and 1.4 (Section 11, Q-011).

**How to read this document**

- Priorities: P0 = must-have, P1 = should-have, P2 = nice-to-have. Every key feature in the original brief is P0 by instruction.
- Source brief: `ANALYST-PROMPT.md`. Where discovery changed a decision in that brief, Section 9.5 records the change. Follow this document where the two differ.
- Technical specification: `SPEC.md`. Version 1.1 of this document brings it in line with the requirement changes agreed during architecture (SPEC.md Section 0, items R-01 to R-19). Section 9.6 maps each change to the text it touched. A requirement changed in 1.1 carries a "Changed in 1.1" or "Added in 1.1" line. Where SPEC.md and this document still differ, SPEC.md wins.
- Version 1.2 applies the stakeholder's answers recorded in `DECISIONS.md` (D-010 to D-017). Section 9.7 maps each answer to the text it touched. A requirement changed in 1.2 carries a "Changed in 1.2" line.
- Version 1.3 applies the later answers in `DECISIONS.md` (D-013 as confirmed, D-020, D-022 to D-027). Section 9.8 maps each answer to the text it touched. A requirement changed in 1.3 carries a "Changed in 1.3" line.
- Version 1.4 applies D-028 (navigation and parallel work) and D-031 (window default) from `DECISIONS.md`. Section 9.9 maps each to the text it touched. A requirement changed in 1.4 carries a "Changed in 1.4" or "Added in 1.4" line. Exception to "SPEC.md wins": SPEC.md 1.7 was written before D-028 was applied, so for FR-003, Section 4.19, FR-152 and Section 8.9 this document is the newer source until SPEC.md is updated.
- Section 10.2 lists answers the analyst proposed and the stakeholder accepted without comment. They are treated as confirmed, but they are the first place to look if something seems wrong.
- Section 11 lists what is still open.
- This file is the index. The text is in the `requirements/` folder, split by section; the section and requirement numbers did not change. A reference such as "REQUIREMENTS.md Section 4.7" or "FR-060" is found through the tables below.

## The requirements, version 1.4

| File | Holds |
|------|-------|
| `requirements/overview.md` | Sections 1 to 3: purpose, problem, success criteria, scope; stakeholders; the two roles (creative user, external agent) |
| `requirements/projects-and-subjects.md` | 4.1 Projects, 4.2 Subjects (FR-001 to FR-012) |
| `requirements/brief-campaigns-templates.md` | 4.3 Brief Intake, 4.4 Campaigns, 4.5 Templates and Slots (FR-020 to FR-045) |
| `requirements/assets-and-generation.md` | 4.6 Asset Import and Reuse, 4.7 AI Generation (FR-050 to FR-069) |
| `requirements/variants-links-sync.md` | 4.8 Variants, Links and Sync (FR-070 to FR-084) |
| `requirements/editor.md` | 4.9 Editor (FR-090 to FR-098) |
| `requirements/localization-and-checks.md` | 4.10 Localization, 4.11 Brand and Legal Checks (FR-100 to FR-116) |
| `requirements/video.md` | 4.12 Video and Animation (FR-120 to FR-132) |
| `requirements/export-reporting-publish.md` | 4.13 Export, 4.14 Reporting and Logging, 4.15 Cloud Publishing (FR-140 to FR-164) |
| `requirements/settings-and-repository.md` | 4.16 Settings and Keys, 4.17 Repository (FR-170 to FR-181) |
| `requirements/agent-control.md` | 4.18 External Agent Control, the MCP server (FR-190 to FR-201) |
| `requirements/navigation-and-window.md` | 4.19 Navigation and Parallel Work, 4.20 App Window (FR-210 to FR-220) |
| `requirements/workflows.md` | Section 5: the eight user workflows, 5.1 to 5.8 |
| `requirements/data-and-integrations.md` | Sections 6 and 7: data entities, volumes, privacy, migration; integrations |
| `requirements/non-functional.md` | Section 8: performance, reliability, security, logging, accessibility, platforms, look and feel |
| `requirements/constraints.md` | Sections 9.1 to 9.4: technical, organizational, legal, timeline and budget constraints |
| `requirements/change-history.md` | Sections 9.5 to 9.9 and 13: what changed from the brief and in versions 1.1 to 1.4, the revision table |
| `requirements/assumptions-and-open-items.md` | Sections 10 and 11: assumptions, analyst proposals accepted without comment, open items |
| `requirements/glossary.md` | Section 12: glossary |

## Drafts not yet merged into the sections above

Each was written after version 1.4 as a separate part. They keep their own section numbers. Where a draft and `DECISIONS.md` differ, `DECISIONS.md` is newer and wins. The `DECISIONS-PENDING` files they name are now rows of `DECISIONS.md`.

| File | Holds |
|------|-------|
| `requirements/draft-client-input.md` | The client's input: FR-230 to FR-249; the items S-1 to S-17 are not decided |
| `requirements/draft-d053.md` | The stakeholder's answers in D-053: FR-294 to FR-308, and changes to earlier requirements |
| `requirements/draft-d054.md` | The stakeholder's answers in D-054: FR-332 and FR-333 |
| `requirements/draft-comfyui.md` | ComfyUI as a provider, Draft 4: FR-250 to FR-293 |
| `requirements/draft-comfyui-custom.md` | Custom ComfyUI workflows, Draft 5: FR-309 to FR-331. D-104 replaced parts of it (workflows are kept per computer, not per project); `spec/comfyui-custom.md` lists which |
