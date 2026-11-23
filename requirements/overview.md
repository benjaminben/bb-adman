# Requirements: overview, stakeholders and roles

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 1. Project Overview

### 1.1 Purpose
A desktop app that lets a non-technical member of a creative team turn a campaign brief into a set of social ad posts. The app reuses existing assets, generates missing ones with AI, and produces every post in the required aspect ratios, languages and formats (image or video). It is similar in spirit to Canva, but local, centred on digital marketing, open to several AI providers, and controllable by an external AI agent.

### 1.2 Problem Statement
The client is a global consumer goods company that launches hundreds of localized social ad campaigns each month. Today:

1. Creating and localizing variants by hand is slow, expensive and error-prone.
2. Creative from decentralized teams and agencies is often off-brand or low quality.
3. Approvals are slow because many people per region must review.
4. Performance data is siloed and reported by hand.
5. Skilled staff spend their time on repetitive requests.

This build addresses items 1, 2 and 5 directly. It helps item 3 by producing organized, shareable deliverables. Item 4 is out of scope.

### 1.3 Success Criteria
- A user can go from a brief file to a full exported set of posts (all chosen ratios and languages) without editing a settings file or reading the README. *(Changed in 1.2: D-015. Accepted exception: the user may need the README for the standard first-launch steps of an unsigned app (8.7).)*
- A change made to a master variant can be reviewed and applied to all linked variants in one review step.
- Text stays editable and translatable up to the moment of export. The image model never draws the text.
- Every export runs the campaign's brand and legal checks and produces a report.
- A project can be packaged into one folder with the "Package project" command (FR-008). The packaged folder can be copied to another machine and opened there with nothing missing. *(Changed in 1.1: R-09. Before, copying the project folder itself was enough.)*
- A user with their own AI subscription or enterprise AI can have an external agent place copy in the app without paying for a separate layout API.
- While a generation runs, the user can work on another variant or another campaign, and can find the finished result later without running it again (Section 4.19). *(Added in 1.4: D-028.)*
- The stakeholder has set no measurable targets (time per campaign, campaigns per month).

### 1.4 Scope

**In scope:**
- Projects stored as single files on the user's computer, each holding several campaigns and a shared set of subjects. Asset files are linked from where they are, or kept in an assets folder beside the project file.
- Packaging a project and its files into one folder so it can be moved to another machine.
- Brief intake from JSON, YAML, markdown or plain text, or from a form.
- Asset import and reuse within a project.
- AI generation of images, text layout proposals, copy options, translations and image-to-video.
- A layer-based editor (background, image and text layers).
- Variants along ratio, language and format, with links, overrides and a sync review.
- Video variants with a timeline, a multi-clip background track, and entrance and exit text animations.
- Brand and legal checks before export.
- Export to an organized folder, with a report.
- Publishing a campaign's components and deliverables to cloud storage.
- An MCP server that lets an external agent read and edit the open project.
- Working on several campaigns and several variants at the same time, including while a generation runs (Section 4.19). *(Added in 1.4: D-028.)*
- A public repository with a README.

**Out of scope for this build:**
- Login, roles and per-user access control. The app is single-user.
- Two people editing the same campaign. Sharing a project means packaging it (FR-008) and passing on the packaged folder.
- Sharing subjects or assets between separate projects, other than by import or copy.
- Automatic cloud sync or cloud backup of editable project data.
- Share links for published files.
- Posting to social platforms, ad spend and performance analytics.
- Approval workflows inside the app.
- User-made templates.
- Changing which properties a link follows.
- An external agent starting paid image or video generation, exporting to disk, or publishing to cloud. These are deferred and may be allowed later, so the design should not rule them out.
- An external agent reading or changing saved keys. This is never allowed.
- Viewing a saved provider or storage key in full (FR-173). The agent access token is not covered by this: the user can view it (FR-191).
- Editor features: shapes, text effects (shadow, outline, fill), grouping, safe-zone overlays, masks, blend modes, filters, freehand drawing, stock libraries, multi-page documents.
- Timeline features: custom keyframes, easing curves, animation of image layers, audio tracks, splitting a clip in two, transitions between clips, overlapping clips.
- Editing the content of generated video inside the app.
- Audio. All video is silent.
- Right-to-left languages.
- Importing a corrected translation sheet back into the app.
- Cultural adaptation of copy as a separate feature. Translation takes region and audience as context only.
- Dark theme.
- Sending telemetry. Automatic app updates.
- Signed installers (8.7).
- Azure as a working cloud storage service. It is listed but disabled (FR-160).

## 2. Stakeholders

| Role | Name / Team | Responsibilities | Notes |
|------|-------------|------------------|-------|
| Sponsor | Corporate client (global consumer goods company) | Owns the business goals in the brief | No named contact recorded |
| Product owner | The stakeholder interviewed for this document | Decides requirements and priorities | |
| Primary users | Creative team members | Build campaigns, edit posts, export and publish | Not technical |
| Secondary users | Teammates without the app | View published files in cloud storage | Never open the app |
| Secondary users | Translator or interpreter colleagues | Verify the exported translation sheet | Work outside the app |
| Operations / Admin | None | | Single-user desktop app, user supplies own keys |
| External parties | AI providers, cloud storage providers | Supply generation and storage through the user's own accounts | |
| External parties | External agent apps | Connect to the app's MCP server on the user's behalf | Run under the user's own subscription or enterprise AI |
| External parties | Readers of the public repo | Read the code and run the app from the README | |

## 3. User Roles & Permissions

### 3.1 Creative User
- **Description:** A member of a creative team. Comfortable with design tools such as Canva, Photoshop or Premiere. Not technical. Will not edit config files or use a terminal.
- **Permissions:** Everything in the app. There is one human role.
- **Key Workflows:** Create or open a project, start a campaign from a brief, fill template slots, edit the master variant, fan out, review sync, approve translations, export, publish. The user often has several campaigns and variants in hand at once, and switches project less often (FR-210). *(Changed in 1.4: D-028. Last sentence added.)*

### 3.2 External Agent
- **Description:** An AI agent running in another app on the same computer, connected through the MCP server. It acts for the Creative User, who gives it instructions in that other app.
- **Permissions:** Limited to the actions in Section 4.18. Destructive actions need the user's permission in the app's UI. It can never see keys.
- **Key Workflows:** Look at a variant, place and style copy, write copy and translations, set up campaigns and variants, change a variant's format, run checks. *(Changed in 1.3: D-025. Format change added.)*
