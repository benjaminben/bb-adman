# Requirements: the editor

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.9 Editor

**FR-090:** A post is a free stack of layers. Layer types are background, image (including logos) and text. The user can add image and text layers freely.
**Priority:** P0

**FR-091:** Background and text are separate layers. Either can be regenerated or edited without changing the other.
**Priority:** P0

**FR-092:** Layer actions: move, resize, rotate, reorder, show or hide, lock, delete.
**Priority:** P0

**FR-093:** Text properties: font, size, weight, colour, alignment, line spacing.
**Priority:** P0

**FR-094:** Image properties: crop and opacity.
**Priority:** P0

**FR-095:** Undo and redo. There is one undo list per variant and one undo list per campaign.
**Priority:** P0
**Notes:** Edits inside a variant go on that variant's list. Actions at campaign level, such as fan-out, a sync and deleting a variant, go on the campaign's list. Deleting a variant can be undone from the campaign's list. All lists are cleared when the project closes (FR-006).
**Changed in 1.1:** R-17.

**FR-096:** Snapping and alignment guides.
**Priority:** P0

**FR-097:** Keyboard shortcuts for undo, redo, delete, duplicate, nudge with arrow keys and zoom.
**Priority:** P0

**FR-098:** Text that does not fit its box is flagged on the variant. The app never resizes text silently.
**Priority:** P0
