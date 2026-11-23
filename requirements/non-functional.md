# Requirements: non-functional requirements

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 8. Non-Functional Requirements

### 8.1 Performance
- No generation blocks the UI. Image and video generation run in the background with a status indicator, and the user can work anywhere else in the project while they run (FR-215). *(Changed in 1.4: D-028. Before, this named video generation only.)*
- Moving between open campaign tabs and variant tabs must feel immediate to the user. No number has been set. *(Added in 1.4: D-028, "Things should be easy to navigate around".)*
- Exported animation must be identical on fast and slow machines.
- The stakeholder has set no targets for load, response time or export time.

### 8.2 Availability & Reliability
- The app runs on the user's machine. Manual work (import, layout, export) must work with no keys and no AI provider.
- Changes save automatically. A crash loses at most the edit in progress.

### 8.3 Scalability
- No hard limit on subjects per brief, campaigns per project, variants per campaign or video duration.
- No hard limit has been set on how many campaign tabs or variant tabs can be open. The navigation must stay usable when there are more tabs than fit across the window. *(Added in 1.4: D-028. The prototype was not tested with more tabs than fit.)*

### 8.4 Security
- **Authentication:** None in the app. Single user. The external agent connection needs an access token (FR-191).
- **Authorization Model:** None for the user. The external agent is limited to a fixed set of actions, with user permission required for destructive ones.
- **Compliance Standards:** None named.
- **Data Encryption:** Keys encrypted at rest. A saved AI provider key or cloud storage key can never be viewed. Only its last four characters are shown (FR-173). The agent access token is the exception: it is for use on the local computer, and the user can view it in full and copy it in the app (FR-191). *(Changed in 1.2: D-014.)*
- **Threat Model Notes:**
  - The repo is public, so no secret may be committed.
  - Project files and packaged projects are shared between people, so they must never contain keys.
  - A project file received from someone else can point at files on this computer. The app must link only files of an accepted type (FR-051), and must show the user which files a publish will upload before it uploads them.
  - The MCP server is a way into the app. It is off by default, reachable only from the same computer and only with the access token, never exposes keys, cannot spend the user's money on generation, cannot export or publish, and asks before destroying anything.
  - The access token can be viewed in the app by whoever is using the app on that computer. It is never exposed to an agent through the server. *(The stakeholder has not yet decided whether this rule stays: Section 11, Q-019. It applies until they do.)*

### 8.5 Auditability & Logging
- An export report per export (FR-150, FR-151).
- Generated assets carry provider, model and prompt (FR-068).
- A local activity log that marks agent-made actions (FR-153, FR-200).

### 8.6 Accessibility
Reference standard: WCAG 2.1 AA for the app's controls.
- Every control can be reached and triggered by keyboard. This includes the campaign tabs, the variant tabs and the project switcher. *(Changed in 1.4: D-028. Second sentence added.)*
- Every control has a label a screen reader can read.
- Focus is always visible.
- Text meets standard contrast levels.
- A tab's "running" and "finished, not yet looked at" marks (FR-218) are not carried by colour alone and can be read by a screen reader. *(Added in 1.4: D-028.)*
- The contents of the design canvas are best effort.

### 8.7 Maintainability & Operability
- Public repository with a README.
- Setup must be as short as possible. The user must not need the README or a settings file to get running.
- New versions are installed by manual download.
- Installers are unsigned in this build. The operating system's security warnings on first launch are accepted. *(Added in 1.1: R-16.)*
- Accepted exception to "must not need the README": the user may need the README for the first launch of an unsigned app. This covers only the standard steps for opening an unsigned app on the operating system. *(Added in 1.2: D-015.)*

### 8.8 Platforms
- macOS and Windows.

### 8.9 Look and Feel
- Clean and light, aimed at a non-technical user.
- Light theme only in this build.
- The navigation is built for parallel work (FR-210): campaign tabs on top, variant tabs inside a campaign, and a small project switcher beside the campaign tabs. The stakeholder tried this layout in prototype round 2 and accepted it ("Navigation layout feels MUCH better"). *(Added in 1.4: D-028.)*
- The app window opens maximized, not full screen (FR-220). *(Added in 1.4: D-031.)*
- The screen list below is a starting point. The stakeholder expects to adjust it during the build.
  - **Start screen:** create a project, open a project file, recent projects.
  - **Project switcher:** a small control beside the campaign tabs that names the open project. From it the user reaches the project home, switches to a recent project, opens a project file, creates a project and closes the project (FR-003). *(Changed in 1.4: D-028. Replaces "Project tabs: each open project is a tab in the one window".)*
  - **Campaign tabs:** one main tab per open campaign, with a way to open another campaign or start a new one (FR-211). A tab shows when its campaign has a generation running or a finished result not yet looked at (FR-218). *(Added in 1.4: D-028.)*
  - **Project home:** campaigns and subjects. New campaign from a brief file or a blank form.
  - **Campaign view:** a row of variant tabs: the overview, then one tab per open variant (FR-212). The overview is one grid of variants per direction, grouped by ratio, language and format, with thumbnails and status badges. Rule set, sync and export actions. A variant can be opened from its tile, with or without leaving the overview (FR-214). *(Changed in 1.4: D-028. Variant tabs and the two ways of opening added.)*
  - **Editor:** shown in a variant tab. Canvas in the centre, layer list on one side, properties on the other, timeline along the bottom for video variants. *(Changed in 1.4: D-028. "Shown in a variant tab" added.)*
  - **Panels and dialogs:** brief confirmation, template slots, generation, run confirmation (generation count and provider), fan-out background fit, sync review, export, publish, report, agent permission request, import (link or copy, library), locate a missing file, package project. The generation dialog can be closed while its run continues, and reopened on the finished result (FR-215, FR-216). *(Changed in 1.4: D-028. Last sentence added.)*
  - **Settings:** keys, default providers, cloud storage, default project location, MCP server on or off, MCP access token, automatic permission for agent actions.
  - **Activity panel:** background jobs from every open campaign in one list, with status and retry. Each entry names its campaign, variant and layer and leads there (FR-152, FR-217). *(Changed in 1.4: D-028.)*
