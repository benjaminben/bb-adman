# Requirements: glossary

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 12. Glossary

| Term | Definition |
|------|------------|
| Project | A single file on the user's computer holding campaigns and subjects, with links to its assets |
| Project file | The one file that is a project. It has the app's own extension (`.adman`). |
| Assets folder | The folder, by default beside the project file and named after it, where generated files and copied imports are saved |
| Linked file | An imported file that stays where it is on the user's machine and is used by the project from there |
| Reference library | The project's files that are used only as input to image generation |
| Asset library | The project's files that can go on a post |
| Hero image | An asset-library image attached to a subject. Used on a post as-is. |
| Package project | The command that gathers everything related to a project (the project file and every asset file the project has a record of, whether linked or in its assets folder) into one folder, so the project can move to another machine |
| Subject | What an ad is about: a product or a service. Has a unique ID. Called "product" in the brief. |
| Campaign | A set of posts for one region, built from one brief |
| Brief | The input describing a campaign: one or more subjects, region, audience, message |
| Template | A list of expected image and copy slots, with no positions |
| Slot | One expected piece of content in a template |
| Direction | One creative approach within a campaign, with its own master variant |
| Variant | One post, defined by ratio, language and format. Has a unique short ID. |
| Master variant | The variant in a direction that all linked variants follow |
| Fan-out | Creating the grid of linked variants from a master variant |
| Link | A connection from a layer to the matching layer in the master, so it follows certain properties |
| Override | A linked layer's own value that replaces what it would inherit |
| Sync review | The step where the user previews and accepts pending changes on linked variants |
| Layer | One element of a post: background, image or text |
| Background clip | One still or video item on a video variant's background track |
| Rule set | A campaign's required assets, colour palette, and required and prohibited words per language |
| Readiness check | A check before export for unapproved translations and for text that does not fit its box |
| Publish | Upload a campaign's components and deliverables to cloud storage |
| Provider | An outside service that performs an AI job or stores files |
| MCP server | The part of the app that lets an outside AI agent read and edit the open project, using the Model Context Protocol |
| Access token | A secret value the app issues. An agent app must present it to connect to the MCP server. The user can view and copy it in the app. |
| External agent | An AI assistant in another app that connects to the MCP server and acts for the user |
| Destructive action | An agent action that deletes a campaign or a variant |
| Campaign tab | A main tab of the app. There is one for each campaign the user has open (FR-211). |
| Variant tab | A tab inside a campaign. There is one for each variant the user has open in that campaign (FR-212). |
| Overview | The part of the campaign view that shows the grids of all the campaign's variants. Always available beside the variant tabs. |
| Project switcher | The control beside the campaign tabs that names the open project and lets the user go to another one (FR-003) |
| Activity panel | The one list of running and finished background jobs for the project's open campaigns (FR-152) |
| Not yet looked at | The state of a finished generation whose result the user has not seen (FR-218) |
