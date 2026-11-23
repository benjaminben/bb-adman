# Requirements: user workflows

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 5. User Workflows

### 5.1 Create a campaign from a brief

**Actor:** Creative User
**Precondition:** A project is open.
**Steps:**
1. The user starts a new campaign and drops in a brief file, or chooses a blank form.
2. The app reads the brief. For markdown or plain text it extracts the fields with AI.
3. The app shows the filled-in form. The user corrects it, confirms or picks a subject ID for each subject, picks ratios and languages, and sets the rule set or copies it from another campaign.
4. The user picks a starter template. The app shows each slot as filled or empty.
5. For each empty image slot the user opens the generation panel and sets the number of options. A confirmation dialog shows the generation count and the provider, which the user can change. The user runs it and picks a result.
6. Text layout is proposed by the layout API, by an external agent (workflow 5.7) or placed by hand. The app creates editable text layers. The campaign message is placed word for word.
7. The user edits the master variant in the editor.

**Postcondition:** The campaign has one direction with an approved master variant.
**Alternate Paths / Exceptions:** No key saved: the app asks for one at the first AI action. Provider failure: plain-language message and retry. Subject ID already exists: the user reuses the existing subject or enters a different ID. The user does not wait for a generation in step 5: they close the panel, work elsewhere and pick the result later (workflow 5.8). *(Changed in 1.4: D-028. Last path added.)*

### 5.2 Fan out and localize

**Actor:** Creative User
**Precondition:** The master variant is approved.
**Steps:**
1. The user starts fan-out.
2. For each new ratio the app shows a dialog. The user chooses scale, crop or generate fill for the background.
3. The app creates a linked variant for each ratio, language and format. Language variants get AI-proposed translations. A variant that differs from the master in both size and language takes its text position and size once from the variant with the same size in the master's language (FR-079).
4. The campaign view shows the direction's grid of variants with status badges.
5. The user opens flagged variants and fixes overflowing text or adjusts a background.
6. The user approves each translation, or exports the translation sheet for a colleague first.

**Postcondition:** Every variant exists and its translations are approved.
**Alternate Paths / Exceptions:** Translation fails: the variant shows the source copy and a retry action. Generate fill fails: the background stays scaled or cropped and retry is offered.

### 5.3 Sync a change

**Actor:** Creative User
**Precondition:** Variants are linked to a master variant.
**Steps:**
1. The user edits a layer in the master variant.
2. Linked variants are marked out of date.
3. The user starts a sync.
4. The review shows a preview per affected variant, with new translations where copy changed. Layers with overrides are flagged and skipped.
5. The user accepts all, or selects some and accepts those.
6. The user resolves flagged layers one by one and edits any outliers.

**Postcondition:** No variant is out of date, or the remaining ones are left that way on purpose.

### 5.4 Add a creative direction

**Actor:** Creative User
**Precondition:** A campaign has at least one master variant.
**Steps:**
1. The user duplicates a master variant.
2. The copy becomes the master of a new direction. The user names the direction and changes it, for example with a new background.
3. The user fans out the new direction (workflow 5.2).

**Postcondition:** The campaign view shows a grid for each direction.

### 5.5 Make a video variant

**Actor:** Creative User
**Precondition:** A variant exists with a finished background.
**Steps:**
1. The user sets the variant's format to video and sets a duration.
2. On the background track the user keeps the still image, imports video files, or starts video generation for this variant.
3. Generation runs in the background. The activity panel, the variant tile and the tabs of the variant and its campaign show its status (FR-218). *(Changed in 1.4: D-028. Tabs added.)*
4. The user arranges and trims the background clips. Uncovered time shows black.
5. The user sets when each layer appears and disappears, and adds entrance and exit presets to text layers.
6. The user plays the preview.

**Postcondition:** The variant previews as it will export.
**Alternate Paths / Exceptions:** Generation fails: the track keeps what it had and retry is offered. The user sets the format back to image: the variant becomes an image variant, and its video settings are kept for a later change back to video (FR-120). *(Changed in 1.3: D-020, D-026. The path back to image is added.)*

### 5.6 Export and publish

**Actor:** Creative User
**Precondition:** At least one variant exists.
**Steps:**
1. The user chooses a variant, a selection or the whole campaign, and an output folder.
2. The app runs the brand and legal checks and the readiness checks (unapproved translations, overflowing text).
3. If any fail, the app lists the warnings. The user fixes them or proceeds.
4. The app writes the files into the organized folder layout and saves the report.
5. The user can then publish the campaign to cloud storage. If files for this campaign are already there, the app warns before replacing them.

**Postcondition:** Deliverables and report are on disk, and in cloud storage if published.

### 5.7 Place copy with an external agent

**Actor:** Creative User, External Agent
**Precondition:** The MCP server is turned on in Settings. The agent app is connected with the access token (FR-191). A variant has a background.
**Steps:**
1. In the agent app, the user asks the agent to lay out the copy on one or more variants.
2. The agent reads the campaign and the variants, and requests a rendered picture of each.
3. The agent creates or moves text layers and sets their style and copy.
4. The changes appear in the app as they happen. The user watches, and can undo any of them.
5. If the agent supplies translations, they show as unapproved until the user approves them.
6. If the agent edited a master, linked variants are marked out of date and the user runs a sync review.

**Postcondition:** The variants have editable text layers placed by the agent, recorded as agent-made in the log.
**Alternate Paths / Exceptions:** The agent tries to delete a campaign or variant: the app asks the user for permission, unless the user has set this to automatic. This includes a campaign the agent created itself (FR-195, FR-197). The agent asks for an action it is not allowed: the server refuses and says why. The agent creates a campaign: it appears in the app at once with no confirm form. Undo does not remove it. *(Changed in 1.3: D-023. Wording now states that a campaign the agent created is deleted under the same permission rule as any other.)*

### 5.8 Keep working while a generation runs

*(Added in 1.4: D-028.)*

**Actor:** Creative User
**Precondition:** A project is open with at least two campaigns. A variant is open in a tab.
**Steps:**
1. In the variant, the user starts an image generation for one layer and confirms the run (FR-062 to FR-064).
2. The user closes the generation dialog. The run continues (FR-215).
3. The user opens another variant, or another campaign in its own tab, and works there. They can start another generation there.
4. The first run finishes. The tabs of its campaign and its variant show that a result is waiting (FR-218). The activity panel lists it with its campaign, variant and layer (FR-152, FR-217).
5. The user goes to the result from the tab or from the activity panel. The app shows the options the run produced, with no new run (FR-216). The user picks one or runs again (FR-063). The "not yet looked at" mark goes away.
6. The user goes back to the other tab and finds it as they left it (FR-213).

**Postcondition:** The layer has the picked image. No work in the other tabs was interrupted or lost.
**Alternate Paths / Exceptions:** The run fails: the activity panel shows a plain-language reason and a retry action (FR-069, FR-152), and the layer keeps what it had. The user switches or closes the project while the run is going: not decided (Q-039).
