# Requirements: variants, links and sync

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.8 Variants, Links and Sync

**FR-070:** A campaign has any number of variants. A variant is one post. It has a unique short ID, a title, a ratio (or size), a language, a format (image or video), a duration if it is a video, its subjects and a stack of layers.
**Priority:** P0
**Notes:** Titles do not have to be unique. The short ID is what tells variants apart.

**FR-071:** A variant can feature one subject or several together.
**Priority:** P0

**FR-072:** A campaign has one or more creative directions (for example "Beach" and "Studio"). Each direction has exactly one master variant. All cascading changes in a direction come from its master.
**Priority:** P0

**FR-073:** A master variant can be edited. It cannot be deleted while its direction exists, and another variant cannot be made the master in its place.
**Priority:** P0

**FR-074:** A new direction is made by duplicating a master variant. The copy becomes the master of the new direction. The campaign view shows one grid per direction.
**Priority:** P0

**FR-075:** Fan-out creates the grid of variants for the chosen ratios, languages and formats, each linked to the direction's master. Fan-out is a separate step the user starts after approving the master.
**Priority:** P0
**Notes:** Image and video variants in a direction share the one master. Format is a choice made at fan-out. A variant's format can also be changed later, from image to video or from video to image (FR-120). A variant that differs from the master in both size and language gets its text position and size by a one-time copy (FR-079).
**Changed in 1.1:** R-05 (confirmed), R-02 (notes only).
**Changed in 1.2:** D-012 (notes only).
**Changed in 1.3:** D-020 (notes only). The later change of format now goes both ways.

**FR-076:** During fan-out the app shows a dialog for each new ratio where the user chooses how the background fits: scale, crop, or generate fill to extend the image.
**Priority:** P0
**Notes:** Generate fill is the only image generation in fan-out and happens only when the user chooses it. Translations are the other AI calls in fan-out.

**FR-077:** Background transforms (scale, position, crop) are stored and stay editable later. Cropping never discards pixels.
**Priority:** P0

**FR-078:** A layer in a variant can be linked to the layer with the matching ID in its master. Links are one level deep. Chains are not allowed.
**Priority:** P0
**Notes:** The one-time copy of text position and size at fan-out (FR-079) is not a link and does not create a chain. Every link still points to the master.
**Changed in 1.1:** R-02 (notes only).

**FR-079:** Links follow properties, not whole layers. Across pixel sizes, copy and style follow and position and size do not. Across languages, position and style follow and copy is a translation of the source. Timing and animation always follow the master, whatever the variant's format. These defaults are fixed in this build.
**Priority:** P0
**Notes:**
- Timing and animation are stored on every layer, in image variants as well as video variants. An image variant keeps the values and does not use them. This lets image and video variants share one master (FR-075).
- The background clips of a video variant (FR-121) belong to that variant. They are not linked and do not sync.
- A variant that differs from the master in both size and language has no layer to follow for text position and size. At fan-out it copies them once from the variant with the same size in the master's language. This is a one-time copy, not a link. Later changes to that variant do not carry over.
- Position and size follow the master only in a variant that has the same pixel size (width and height) as the master. Having the same ratio at a different pixel size is not enough. The stakeholder confirmed this ("Correct").
**Changed in 1.1:** R-02, R-05.
**Changed in 1.2:** D-013 (notes only, reading not yet confirmed).
**Changed in 1.3:** D-013, now confirmed. The "not yet confirmed" mark is removed from the note. The requirement text said "across ratios" and now says "across pixel sizes" to match the note.

**FR-080:** A linked layer can override anything it inherits, including background image and copy. Each ratio can have its own background.
**Priority:** P0

**FR-081:** When a master layer changes, linked variants are marked out of date. Nothing changes in another variant until the user starts a sync.
**Priority:** P0

**FR-082:** The sync review shows a preview of the change for each affected variant. The user can accept each one individually, "Accept All" or "Accept Selected", and then edit the remaining ones by hand.
**Priority:** P0

**FR-083:** Layers with an override are skipped by sync and flagged in the review. For each, the user chooses to keep their version, take the master's, or edit by hand.
**Priority:** P0

**FR-084:** When master copy changes, the sync review includes proposed new translations for the other languages.
**Priority:** P0
