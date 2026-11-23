# Requirements: localization, brand and legal checks

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.10 Localization

**FR-100:** Language is a dimension of variant. Each language variant is a version of the text layers over the same background unless overridden.
**Priority:** P0

**FR-101:** The app proposes translations with AI, using the region and audience as context. Every translation needs explicit approval from the user, whatever its source. Unapproved translations are visible as a status on the variant.
**Priority:** P0

**FR-102:** The user can edit any translation.
**Priority:** P0

**FR-103:** The user can export a simple sheet containing all localized copy for a campaign, so a colleague can verify it outside the app. Export only.
**Priority:** P0

**FR-104:** Only left-to-right languages are supported.
**Priority:** P0

### 4.11 Brand and Legal Checks

**FR-110:** Brand check: the campaign's required assets (for example a logo) are present and visible on each variant.
**Priority:** P0
**Notes:** A required asset is "present and visible" on a variant when all of these are true:
- A layer in the variant uses the asset.
- The layer is not hidden.
- The layer's opacity is above zero.
- Part of the layer is inside the canvas.
- For a video variant, the layer is on screen for part of the duration.

The check does not test whether another layer covers the asset.
**Changed in 1.1:** R-13 (definition added).

**FR-111:** Brand check: the colour of every text layer comes from the campaign's palette.
**Priority:** P0

**FR-112:** Brand check: colours inside background images can be checked through an optional outside verification provider.
**Priority:** P2
**Notes:** Not built in this build. Whether it is built later depends on an assessment of the verification provider, which is due after this build (OI-01).
**Changed in 1.3:** Notes only (SPEC.md OI-19). Before, the note read as if the assessment were still due in this build.

**FR-113:** Legal check, run for each variant against the word lists for that variant's language (FR-033):
- Prohibited words: no prohibited word appears in any text layer of the variant.
- Required words: every required word appears somewhere in the variant's text layers taken together. One text layer does not have to hold them all.
**Priority:** P0
**Notes:** The check covers every variant in every language. A language with no word list has nothing to check.
**Changed in 1.1:** R-03. Before, required words had to be present in every text layer, and the lists were not per language.

**FR-114:** Checks run automatically before export. The user can also run them on demand. This covers the brand and legal checks (FR-110 to FR-113) and the readiness checks (FR-116).
**Priority:** P0
**Changed in 1.1:** R-18.

**FR-115:** A failed check warns the user. The user can proceed with the export. The failure and the decision to proceed are written to the report. This applies to readiness checks (FR-116) in the same way as to brand and legal checks.
**Priority:** P0
**Changed in 1.1:** R-18.

**FR-116:** Readiness checks: before export the app also warns about variants that have an unapproved translation (FR-101) and variants that have text that does not fit its box (FR-098).
**Priority:** P0
**Notes:** These are warnings, handled as in FR-115. They do not replace the status shown on the variant.
**Added in 1.1:** R-18.
