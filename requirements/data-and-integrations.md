# Requirements: data and integrations

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 6. Data Requirements

### 6.1 Key Data Entities
The detailed data model is for the architect. The entities and relationships below are required.

- **Project:** A single file with the app's own extension. Has many campaigns, many subjects, two libraries of assets (reference library and asset library) and one assets folder, by default beside the project file.
- **Subject:** Unique ID, display name, description, reference files. Belongs to a project. Used by many campaigns.
- **Asset:** A file the project uses (image, video, font, text). Either imported or generated. Either linked where it is on the user's machine or saved in the project's assets folder. Belongs to one library: reference or asset. May be attached to a subject. Can be marked missing when a linked file cannot be found. Generated assets carry provider, model and prompt in their file metadata.
- **Campaign:** Region, audience, message, languages, ratios and sizes, subjects, rule set, template. Belongs to a project. Has one or more directions.
- **Rule set:** Required assets, colour palette, required words per language, prohibited words per language. Belongs to a campaign. Can be copied from another campaign.
- **Template:** A list of image and copy slots. Shipped with the app.
- **Direction:** A named creative direction in a campaign. Has exactly one master variant and many linked variants.
- **Variant:** Unique short ID, title, ratio or size, language, format, duration, subjects, layers, status flags (out of date, overflow, translation unapproved, check warning, job running, missing file). Belongs to a direction. Its video settings are kept while its format is image (FR-120). *(Changed in 1.3: D-026.)*
- **Layer:** ID, type (background, image, text), geometry, style, content, visibility, lock, timing (start, end), optional entrance and exit animation (preset, start, duration), optional link to the matching layer in the master, and which inherited properties are overridden. Timing and animation are stored on layers of image variants as well as video variants. Background layers keep their transform (scale, position, crop) without discarding pixels.
- **Background clip:** One item on a video variant's background track: source asset, position in time, trim at each end. Belongs to one variant and is not linked.
- **Job:** A background task (for example image or video generation) with status and result. A generation job records the campaign and variant it belongs to, and the layer when it is for one layer (FR-217). Its result stays available until the user has dealt with it (FR-216). The app knows whether the user has looked at a finished result (FR-218). *(Changed in 1.4: D-028.)*
- **Open tabs:** Which campaigns are open as tabs, which variants are open inside each, which one is showing, and each variant tab's place (FR-211 to FR-213). Kept at least while the project stays open. Whether it is kept between sessions is not decided (Q-040). *(Added in 1.4: D-028.)*
- **Report:** The result of one export.
- **Log entry:** One recorded action, including whether the user or an agent made it.

### 6.2 Data Volumes & Retention
- No limit on the number of subjects, campaigns or variants in version 1, and no performance target tied to size.
- Project data is kept until the user deletes the project file. Asset files are kept until the user deletes them. The app applies no retention rules.

### 6.3 Data Privacy & Compliance
- The app collects no personal data and sends no telemetry.
- Brief content, prompts and reference images are sent to the AI providers the user has configured, under the user's own accounts.
- When the MCP server is on, a connected agent can read the open project's content, including the names of its assets and fonts but not the files themselves. That content then passes to whatever AI service runs the agent.
- Generated assets carry their prompt in file metadata. Anyone given such a file, including through cloud publishing, can read the prompt. Final exports do not carry it.
- Keys are stored encrypted on the user's machine, outside project files, assets folders and packaged projects, and are never committed to the repository or exposed to an agent.
- No compliance standard has been named.

### 6.4 Data Migration
None. This is a new app with no legacy system.

## 7. Integration Requirements

| System | Direction | Protocol / Format | Purpose | Owner |
|--------|-----------|-------------------|---------|-------|
| AI image provider | Outbound | Provider API | Generate, remix and extend images | User's account |
| AI vision provider | Outbound | Provider API | Propose text layout | User's account |
| AI text provider | Outbound | Provider API | Read free-text briefs, copy options, translation | User's account |
| AI image-to-video provider | Outbound | Provider API | Generate video from a background image | User's account |
| Cloud storage (S3 and Dropbox working; Azure listed but disabled) | Outbound | Provider API | Publish components and deliverables | User's account |
| Optional verification provider | Outbound | Provider API | Optional checks such as image colour | User's account |
| External agent app | Inbound | MCP | Read and edit the open project | User's own agent |

**IR-001:** Every AI job and the cloud storage connection sit behind a provider boundary. Swapping a provider must not change the rest of the app.

**IR-002:** Stakeholder preferences for the architect (not requirements):
- Gemini ("nanobanana") as the default for image generation and text layout, because one self-serve key covers both.
- A stubbed adapter for the Adobe Firefly API, plus a research task on integrating Adobe AI products without an enterprise account to test with. *(1.1: the research is done. No route without an enterprise plan was found. Firefly stays a stub. See OI-03.)*
- Seedance for image-to-video, to be tested through fal.ai, with a possible change of route.
- Jev (docs: https://docs.typesafe.ai/introduction) as the optional verification provider. The analyst has not read these docs (OI-01).
- Generation details embedded in files the way ComfyUI does it.

**IR-003:** The inbound agent connection uses MCP, as named by the stakeholder. It is limited to the same computer, to clients that present the access token (FR-191), and to the actions in Section 4.18.
