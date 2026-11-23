# requirements/draft-d054.md

**Project:** Adman
**Date:** 2026-11-20
**Prepared by:** Requirements Analyst
**Status:** Draft 1. An addition to `requirements/draft-d053.md`, written as a separate part. Ready to merge, with no open question of its own.
**Source:** D-054, items 1, 2, 3, 10, 12, 20 and 25 (the stakeholder's words, below). Item 9 (custom ComfyUI workflows) is in `requirements/draft-comfyui-custom.md`.
**Read against:** `requirements/draft-d053.md` Draft 1, `requirements/draft-comfyui.md` Draft 4, `REQUIREMENTS.md` 1.4 (not edited).

## What this file is

What seven of the stakeholder's D-054 answers close or change. It says what is needed. It does not say how to build it.

Why it is a separate file: it was written without a tool that edits a file in place. Section 3 lists each change to `requirements/draft-d053.md` as old and new, so the merge is mechanical.

New numbers: FR-332 and FR-333. FR-309 to FR-331 are in `requirements/draft-comfyui-custom.md`. The highest number in use is now FR-333.

---

## 1. Answered (D-054)

Answers are word for word. Item numbers are those of D-053.

| Item | About | Answer | What it closes or changes |
|------|-------|--------|---------------------------|
| 1 | Brief size limit (16 KB as built; OI-48) | "No imposed limit on brief size, that is unnecessary. In general we don't care about nuisance attacks like these. The only attacks we care about (and we truly do) are destructive ones, ones that give access to sensitive data, or allow the attacker to assume any form of unexpected privileged access. That should be a general principle for future development as well" | The limit is removed (FR-332). OI-48 is closed. A security principle is added (FR-333). |
| 2 | Held event-name test (T3) | "OK" | The test goes ahead. Not a product requirement. |
| 3 | A project file made by someone else (OI-47, OI-49): files saved to an outside folder the file names; the app window loading any readable file; the stored size and fingerprint of linked files | "Not concerned about these cases" | Accepted as built. OI-47 and OI-49 are closed. The "came from elsewhere" confirm step that was recommended is not planned. |
| 10 | Usage and spend (CQ-30) | "Estimated cost will have to do if that's all we can easily support for individuals" | CQ-30 is answered: the app's own count with an estimated cost. FR-303 stands. FR-304 (the provider's own figures) is not planned. |
| 12 | Keeping sound | "Great" | Confirms FR-300 to FR-302, and FR-283 in `requirements/draft-comfyui.md`. No text changes. |
| 20 | WebP import | "Great" | Confirms FR-298. No text changes. |
| 25 | AI cut-outs through ComfyUI or fal | "Sounds good" | Confirms FR-307, with ComfyUI and fal as the providers. CQ-33 (several picture layers) is still open. |

How the answers were read:

- Item 1 is read as two things: a decision on one limit, and a rule for all later work. The rule is written in the stakeholder's own terms in FR-333.
- Item 3 is read as a decision on the three named cases as they were described, not on every case of a project file from someone else. A new case is judged by FR-333.
- Item 10: "for individuals" is read against what was found: a provider's own figures need a key of a wider kind, which for OpenAI only an organization owner can create, and Google offers none (`requirements/draft-d053.md`, Section 4.1). So the estimate is the answer for every provider. "Will have to do" is read as: no more work on provider figures now.
- Item 25 is read as agreement with FR-307 as written, including "a local provider is offered first because it costs nothing".

---

## 2. Requirements

### 2.1 Briefs (Section 4.3)

**FR-332 (new):** The app sets no limit of its own on the size of a brief. A brief is not refused because it is long.
**Priority:** P0
**Notes:**
- The stakeholder's words: "No imposed limit on brief size, that is unnecessary."
- The spec has a limit of 16 KB today, set so that a crafted brief could not hold the app up while it is read. That reason is a nuisance case, and it is no longer a reason (FR-333).
- A limit that a provider or a file format itself has is not "imposed" by the app. When a brief is too long for the provider that reads it, the app says so in plain words (FR-069).
- Reading a long brief should not stop the user from working elsewhere in the app. That is ordinary good behaviour (8.1), not a protection, and it is no reason to bring a limit back.
- **Acceptance:** a well-formed brief many times larger than 16 KB is read and produces the same kind of result as a small one.

### 2.2 Security principle (Section 8.4, non-functional)

**FR-333 (new, non-functional):** The project guards against three kinds of attack, and takes them seriously:
1. attacks that are destructive;
2. attacks that give access to sensitive data;
3. attacks that let the attacker assume any form of unexpected privileged access.

The project does not add protections against nuisance attacks: ones that only slow the app, hold it up, make it fail, or waste the user's time, and do none of the three things above. This is a general principle for future development as well.
**Priority:** P0
**Notes:**
- The stakeholder's words: "In general we don't care about nuisance attacks like these. The only attacks we care about (and we truly do) are destructive ones, ones that give access to sensitive data, or allow the attacker to assume any form of unexpected privileged access. That should be a general principle for future development as well".
- How to use it: for each proposed protection, name which of the three kinds it stops. If it stops none, it is not built, and a limit that exists only for that reason can be removed.
- What it does not change: every existing rule about keys and secrets (FR-170 to FR-173, FR-198), about where prompts and pictures are sent (FR-273 to FR-275), about treating a provider's or server's answers as untrusted (FR-277), and about what an agent can reach (FR-272, FR-279). Each stops one of the three kinds.
- A limit can still exist for another reason: a provider's own limit, a file format's limit, or plain usability. The principle removes only the "nuisance attack" reason.
- It has been applied twice already: FR-332 (a nuisance case, the limit goes) and the safety part of custom workflows (`requirements/draft-comfyui-custom.md`, Section B.6: a workflow that reads files, writes files or runs code on the server is covered; a workflow that is slow or fills a disk is not).
- Existing limits that were set only against nuisance (for example on file counts, depths or sizes of things the app reads) are not removed by this file. Whether each one goes is for the architect to propose, one by one. A limit the stakeholder has set himself stays (for example FR-294: 12 levels, 500 files).
- **Acceptance:** each security rule in the spec names the kind of harm it stops; a reviewer does not fail a change for lacking a protection against nuisance alone.

### 2.3 Usage and spend (Section 2.4 of `requirements/draft-d053.md`)

- **CQ-30 is answered: option B.** The app's own record of every paid call, with an estimated cost.
- **FR-303** is no longer "proposed". It is P0.
- **FR-230 (changed)** stands as written in `requirements/draft-d053.md`, at P0.
- **FR-304** (the provider's own figures beside the estimate) is **not planned**. No second, wider key is asked for or stored.
- **FR-305** (the price list is shown and the user can correct it) stays, P1. An estimate is only as good as its prices, and the client may pay other rates. The part of FR-305 that brings prices up to date from a provider, with the ordinary key, stays optional.
- Every money figure the app shows is marked as an estimate (FR-303). With FR-304 gone, the app also says once, near the figures, that the provider's own bill is the true amount and where to see it.
- Saving the figures as a spreadsheet file (FR-303 notes) was not answered. It stays as proposed.

### 2.4 A project file made by someone else (OI-47, OI-49)

The three cases are accepted as built:
- files saved to an assets folder outside the project folder, when the project file names that folder and the folder exists;
- the app window being able to load any file the user's account can read;
- the size, fingerprint, type and pixel size stored in the project file for linked files being taken as stored.

No requirement text changes. No "came from elsewhere" step is planned. FR-296 (a missing outside folder is not made again) stands, since the stakeholder agreed to it in D-053 item 5.

---

## 3. Changes to make in `requirements/draft-d053.md` and elsewhere when merging

| # | Where | Today | Change |
|---|-------|-------|--------|
| Y-1 | `requirements/draft-d053.md`, Section 1, items 1, 2, 3 | "A question, not a decision. Nothing changed." | Add the D-054 answers from Section 1 above. |
| Y-2 | `requirements/draft-d053.md`, Section 2.4, opening | "They are **proposed**: the stakeholder ... has not yet chosen (CQ-30)." "the recommended option (C: both)" | Decided: option B. Remove "proposed" from FR-303 and FR-230. |
| Y-3 | `requirements/draft-d053.md`, FR-304 | P1 (proposed). | Mark "Not planned (D-054 item 10)". Keep the text for the record. |
| Y-4 | `requirements/draft-d053.md`, Section 4.3, recommendation | Option C in two steps. | Add: the stakeholder chose the first step only (option B). |
| Y-5 | `requirements/draft-d053.md`, Section 6, CQ-30 | Open. | Closed by D-054 item 10. |
| Y-6 | `requirements/draft-d053.md`, Section 6, last line | "Still open ...: items 1 and 3 of D-053". | Both closed by D-054. OI-51 and Dropbox stay open. |
| Y-7 | `requirements/draft-d053.md`, conflicts X-16 and X-17 (FR-172 and the wider key) | A wider key saved to read usage. | X-16 falls away: there is no wider key. |
| Y-8 | `requirements/draft-comfyui.md`, Section 0.2, row "FR-170 to FR-172, the key rules" | "A second, wider key may be saved to read a provider's own usage figures (FR-304 ...)". | Remove the row. |
| Y-9 | `requirements/draft-comfyui.md`, FR-287 notes | "The stakeholder has not yet chosen (CQ-30)." | Chosen: the app's own record with an estimated cost. |
| Y-10 | `requirements/draft-comfyui.md`, U-26, U-27 | Whether a key can read usage. | No longer matter. Closed. |
| Y-11 | `requirements/draft-d053.md`, Section 2.9, and A-D7 | The scope rule "is not a reason to weaken a protection". | Still true. Add a pointer to FR-333, which says which protections the project wants. |
| Y-12 | `requirements/draft-d053.md`, FR-298 notes | "The size and type limits that apply to PNG and JPEG apply to WebP." | Unchanged. Whether those limits stay is part of the architect's review under FR-333. |
| Y-13 | Spec: the 16 KB brief limit, its timed tests and stop rule (OI-48) | A limit, with tests that enforce it. | Removed (FR-332). For the architect. |
| Y-14 | Spec and open items OI-47, OI-49 | Open, with a recommended confirm step. | Closed, accepted as built. |
| Y-15 | `REQUIREMENTS.md` 8.4 | A list of protections with no stated rule for what is in or out. | Add FR-333 at the top of the section. |
| Y-16 | `requirements/draft-d053.md`, FR-307 and CQ-33 | FR-307 P1. | Confirmed (D-054 item 25). CQ-33 stays open. |

---

## 4. Open questions

None new in this file. CQ-37 to CQ-41 are in `requirements/draft-comfyui-custom.md`. Still open from before: CQ-31, CQ-32, CQ-33, CQ-34, CQ-35 (in part), CQ-36, OI-51, Dropbox.

---

## 5. Assumptions

| # | Assumption | Impact if wrong |
|---|------------|-----------------|
| A-E1 | "No imposed limit" covers briefs of every accepted type (txt, md, JSON, YAML). | FR-332 narrows to one type. |
| A-E2 | Spending the user's money without their knowing is treated as a serious case, not a nuisance, although the three kinds do not name money. It is closest to "unexpected privileged access": using the user's key or account. | Rules on agent spending (FR-279, FR-292) and the paid-step notice in FR-330 would be judged as nuisance. The stakeholder has already said "no spending cap", so the effect is small. |
| A-E3 | Item 3 accepts the three named cases only. | More cases around a project file from someone else may be accepted without review. |
| A-E4 | Dropping FR-304 also drops the optional wider key everywhere. | The key rules would need the wider key back. |
| A-E5 | FR-333 does not by itself remove existing limits; each is reviewed. | Limits set against nuisance would all go at once. |

---

## 6. Revision history

| Version | Date | Changes |
|---------|------|---------|
| Draft 1 | 2026-11-20 | D-054 items 1, 2, 3, 10, 12, 20, 25 recorded. FR-332 (no brief size limit), FR-333 (security principle). CQ-30 closed: estimated cost from the app's own count. FR-304 not planned. OI-47, OI-48, OI-49 closed. Changes Y-1 to Y-16. |
