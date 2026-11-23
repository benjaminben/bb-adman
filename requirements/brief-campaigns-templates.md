# Requirements: brief intake, campaigns, templates and slots

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.3 Brief Intake

**FR-020:** The app accepts a campaign brief as a JSON file, a YAML file, a markdown file or a plain text file. The user can also fill in a form with no file.
**Priority:** P0

**FR-021:** A brief contains: one or more subjects, target region or market, target audience and campaign message. The app must handle a brief with two or more subjects, with no hard upper limit. A brief with a single subject is also valid.
**Priority:** P0
**Notes:** Optional extra fields are accepted: offer, call-to-action, tone, required words, prohibited words, and copy per language. Required and prohibited words can be given per language. A list given with no language belongs to the campaign's main language (FR-033). A subject in a brief may name its photos; a subject's description is optional. Before the campaign is made, each subject has at least one photo (FR-011).
**Changed in 1.1:** R-03 (notes only).
**Changed after 1.4:** R-21 (notes only).
**Changed in 1.3:** D-024. Before, the text said "at least two must be supported", which could be read as a minimum of two subjects per brief.

**FR-022:** For markdown and plain text briefs, the app uses AI to extract the fields.
**Priority:** P0
**Notes:** This applies to brief files the user gives the app. The app makes no extraction call for a brief sent by an external agent, which arrives as structured fields (FR-195).
**Changed in 1.1:** R-01 (notes only).

**FR-023:** For every brief, the app shows a filled-in form that the user must confirm before any generation happens.
**Priority:** P0
**Notes:** Exception: a campaign created by an external agent is created with no confirm form (FR-195). An agent cannot start generation (FR-199), so generation still starts only when the user asks for it.
**Changed in 1.1:** R-01 (notes only).

**FR-024:** For each subject in the brief, the user either confirms a new subject ID or picks an existing subject from the project. Picking an existing subject reuses its files. The user gives each subject at least one photo before confirming.
**Priority:** P0
**Changed after 1.4:** R-21.

**FR-025:** One brief creates one campaign.
**Priority:** P0

**FR-026:** On the confirm form the user picks the campaign's ratios and languages. Defaults are 1:1, 9:16 and 16:9, and the main language of the region.
**Priority:** P0

**FR-027:** The user can supply translations up front, as copy per language in the brief or typed on the confirm form.
**Priority:** P1

### 4.4 Campaigns

**FR-030:** A campaign targets exactly one region. A second region means a second campaign in the same project.
**Priority:** P0

**FR-031:** A campaign has its own list of languages, its own list of ratios and sizes, and a chosen set of subjects.
**Priority:** P0

**FR-032:** The user can add custom ratios or pixel sizes to a campaign.
**Priority:** P0
**Notes:** Default pixel sizes are 1080×1080 (1:1), 1080×1920 (9:16) and 1920×1080 (16:9).

**FR-033:** A campaign has a rule set: required assets (for example a logo file), a brand colour palette, required words and prohibited words. The required and prohibited word lists are held per language.
**Priority:** P0
**Notes:** Used by the checks in 4.11. A word list given with no language belongs to the campaign's main language.
**Changed in 1.1:** R-03. Before, each word list was one list for the whole campaign.

**FR-034:** When setting up a campaign, the user can copy the rule set from another campaign in the project.
**Priority:** P0

### 4.5 Templates and Slots

**FR-040:** A template is a list of expected content slots, each either an image slot or a copy slot. A template does not define positions.
**Priority:** P0

**FR-041:** The app ships with at least one starter template with these slots: background, subject image, logo, headline (which holds the campaign message) and call-to-action. Users cannot create templates in this build.
**Priority:** P0

**FR-042:** After the brief is confirmed, the app shows each slot as filled (from the brief or from a subject's files) or empty.
**Priority:** P0

**FR-043:** The campaign message from the brief is placed word for word in the main text slot and appears on every final post.
**Priority:** P0

**FR-044:** For an empty image slot, the user can open a generation workflow (see 4.7).
**Priority:** P0

**FR-045:** For an empty copy slot other than the campaign message, the user can type the copy or have the app generate options.
**Priority:** P0
