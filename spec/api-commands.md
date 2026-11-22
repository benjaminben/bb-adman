# Commands

Every command: its input, undo scope, agent policy, whether it is built, and the rules of each. Read with `spec/api-principles.md` (bus, errors, reasons, undo). The rules of how the agent policy is applied (ask, tick, gate) are in `spec/mcp-and-agents.md`. Job behaviour is in `spec/jobs.md`.

## The table

Undo scope: **V** = the variant's list, **C** = the campaign's list, **—** = not undoable. Agent policy: **allow**, **ask**, **deny**, **tick**. The one owner of the policy is `AGENT_POLICY` in `src/main/commands/agent-policy.ts`; `tests/unit/main/commands/agent-policy-table.test.ts` compares the whole table ("and nothing else"). A `tick` row goes to the agent-run gate (`src/main/commands/agent-run-gate.ts`; rules in `spec/agent-runs.md`). "system" marks an `internal: true` command no window may send.

**Scope.** A command is project-scope or app-scope (`spec/api-principles.md`, "Channels, actor and scope").

- **Project-scope:** every row whose input starts with `projectId`. The bus finds the open project and runs the handler in one transaction on its file (`spec/data-rules.md`, "Data flow"). Every other ID in the input is looked up inside that project only.
- **App-scope:** `project.create`, `project.createInDefaultFolder`, `project.open`, `project.close`, `settings.update`, `secret.set`, `secret.delete`, `mcp.setEnabled`, `mcp.regenerateToken`, `agent.answerPermission`, `storage.dropboxSignIn`, `storage.dropboxSignOut`, `storage.checkS3`, `dev.storage`, `comfy.setAddress`, `comfy.check`, `agentRuns.setAllowed`, `agentRuns.setLimit`. They run with no project transaction and have no `ctx.changes`. `project.close` takes a `projectId` but is app-scope, because it closes the file.

| Command | Input | Undo | Agent | Built | Requirements |
|---------|-------|------|-------|-------|--------------|
| `project.create` | name, location | — | deny | Built | FR-002, FR-004 |
| `project.open` | filePath (must end `.adman`) | — | deny | Built | FR-002, FR-003 |
| `project.close` | projectId, runningJobs? (`'refuse'`, the default, or `'stop'`) | — | deny | Built | FR-006, FR-215 |
| `project.createInDefaultFolder` | name (the `project.create` name rule); the folder is always `settings.defaultProjectDir` | — | allow | Built (R2P-8) | Round 2 R-5 |
| `project.setAssetsDir` | projectId, dir | — | deny | Built | FR-007, R-07 |
| `project.package` | projectId, targetDir, skipMissing (default false) (`spec/data-rules.md`, "Package project") | — | deny | Built | FR-008, R-09 |
| `subject.create` | projectId, id, name, description (default '') | — | deny | Built | FR-011 |
| `subject.update` | projectId, subjectId, name?, description? | — | deny | Built | FR-011 |
| `subject.delete` | projectId, subjectId (refused while a campaign uses it) | — | ask (SUBJ-1, D-101) | Built | FR-197 |
| `asset.import` | projectId, paths[], library (`reference` or `asset`), subjectId?, copy: boolean | — | deny | Built | FR-050–FR-054, R-08 |
| `asset.update` | projectId, assetId, library?, subjectId? (null detaches), displayName? (1 to 200), fontPublishAllowed? | — | deny | Built | FR-054, R-12 |
| `asset.relink` | projectId, assetId, newPath, relinkSiblings: boolean | — | deny | Built | FR-009, R-06 |
| `asset.remove` | projectId, assetId (refused while a layer, font, clip or rule set uses it) | — | deny | Built | FR-197 |
| `asset.importFiles` | projectId, paths[] (1 to 20 absolute), library (`asset`, the default, or `reference`) | — | ask (kind `import`) | Built (R2P-5, R2P-5b) | Round 2 R-3 |
| `asset.checkChanged` | projectId (system) | — | deny (system) | Built | — |
| `asset.addGenerated` | projectId, jobId, files[] of { assetId, ext }, model? (1 to 200 characters) (system) | — | deny (system) | Built | FR-063, FR-068, FR-216 |
| `brief.parse` | projectId, filePath or text (exactly one) | — | deny | Built | FR-020, FR-022 |
| `campaign.create` | projectId, brief, subjectMap, sizes, languages, ruleSet or copyRuleSetFrom, templateId | — | allow | Built | FR-023–FR-026, FR-195, R-01 |
| `campaign.createFromBrief` | projectId, text (a brief naming no file path) | — | allow | Built (R2P-7) | Round 2 R-4 |
| `campaign.createFromBriefWithFiles` | projectId, text (a brief naming at least one file path) | — | ask (kind `import`) | Built (R2P-7) | Round 2 R-4 |
| `campaign.update` | projectId, campaignId, name?, audience?, tone?, offer?, callToAction?, languages?, sizes? | C | deny | Built | FR-031, FR-032 |
| `campaign.delete` | projectId, campaignId | — | ask | Built | FR-197 |
| `ruleSet.update` | projectId, campaignId, any of the four lists | C | deny | Built | FR-033 |
| `ruleSet.copyFrom` | projectId, campaignId, sourceCampaignId (both in this project) | C | deny | Built | FR-034 |
| `direction.createFromMaster` | projectId, masterVariantId, name | — | deny | Built | FR-074 |
| `direction.rename` | projectId, directionId, name | C | deny | Built | FR-072 |
| `direction.delete` | projectId, directionId (refused if it is the campaign's last) | — | deny | Built | A-06 |
| `variant.fanOut` | projectId, directionId, sizes[], languages[], formats[] (video cells since P7-23; the fan-out dialog still sends `image` only), fits{} | C | deny | Built | FR-075, FR-076 |
| `variant.add` | projectId, directionId, sizeLabel, language, format, fit? (`scale` or `crop`) | C | allow | Built | FR-195 |
| `variant.remove` | projectId, variantIds[] (system; the inverse of fan-out, `variant.add`, `variant.restore`) | C | deny (system) | Built | R-17 |
| `variant.restore` | projectId, snapshots[] (system; the inverse of `variant.remove`) | C | deny (system) | Built | R-17 |
| `variant.restoreLayers` | projectId, variants[] of { variantId, layers } (system; the inverse of `sync.apply`, `generation.applyFill`) | C | deny (system) | Built | R-17 |
| `variant.update` | projectId, variantId, title (Phase 3); durationMs (Phase 7) | V | allow | Built (title; durationMs P7-10) | FR-070, FR-120 |
| `variant.setFormat` | projectId, variantId, format (`spec/data-rules.md`, "Changing a variant's format") | V | allow | Built (P7-10) | FR-070, FR-120, R-20, D-025 |
| `variant.delete` | projectId, variantId (refused for a master) | — | ask | Built | FR-073, FR-197 |
| `layer.create` | projectId, variantId, type (image or text), values? | V | allow | Built | FR-090, FR-194 |
| `layer.update` | projectId, layerId, patch of copy, style, geometry, source, timing, animation, name, visible, locked | V | allow | Built | FR-092–FR-094, FR-194, FR-249 |
| `layer.delete` | projectId, layerId (refused for a background) | V | allow | Built | FR-092, FR-197 |
| `layer.restore` | projectId, layer (whole row), order (system; only the inverse of `layer.delete`) | V | deny (system) | Built | FR-095 |
| `layer.reorder` | projectId, variantId, layerIds (every non-background layer, lowest first) | V | allow | Built | FR-092 |
| `layer.clearOverride` | projectId, layerId, paths[] | V | deny | Built | FR-080 |
| `layer.revert` | projectId, variantId, layers[] of { layerId, patch, overrides } (system; the inverse of an edit that changed an override list) | V | deny (system) | Built | FR-080, FR-095 |
| `layer.reportOverflow` | projectId, layerId, overflow, variantRev | — | deny | Built | FR-098 |
| `clip.add` | projectId, variantId, assetId, startMs | V | deny | Built (P7-9) | FR-121 |
| `clip.update` | projectId, clipId, startMs?, inMs?, outMs?, placement? | V | deny | Built (P7-9) | FR-122 |
| `clip.remove` | projectId, clipId | V | deny | Built (P7-9) | FR-122 |
| `clip.swap` | projectId, variantId, remove[] (clip IDs), put[] (clip rows) (system; the inverse of a generated clip that replaced the still, and its own inverse) | V | deny (system) | Built (R2E-7) | — |
| `translation.propose` | projectId, variantIds[] or directionId + language | — | deny | Not built (Phase 6) | FR-101 |
| `translation.set` | projectId, layerId, text, applyToSameLanguage: boolean | V | allow | Built | FR-102, FR-194 |
| `translation.approve` | projectId, layerIds[] (becomes layers[] of { layerId, copyRev } in P6-4b) | C | deny | Built | FR-101 |
| `translation.exportSheet` | projectId, campaignId, filePath | — | deny | Built | FR-103 |
| `sync.apply` | projectId, directionId, masterRev, decisions[] | C | deny | Built | FR-082, FR-083 |
| `check.run` | projectId, campaignId or variantIds[] | — | allow | Built | FR-114, FR-116, FR-196 |
| `generation.runImages` | projectId, variantId, slot or layerId (exactly one), prompt, referenceAssetIds[], count (1 to 8), provider, licenceConfirmed? (S2-4) | — | tick | Built | FR-062–FR-065, FR-199 |
| `generation.runFill` | projectId, variantId, provider, licenceConfirmed? (agents may start it: a gate run command) | — | tick | Built | FR-076, D-080 |
| `generation.applyFill` | projectId, jobId (the window sends it when its fill succeeds) | C | deny | Built | FR-076 |
| `generation.proposeLayout` | projectId, variantId, provider (`spec/ai-jobs.md`) | — (applied by `layer.updateMany`, V) | tick | Built | FR-061 |
| `generation.copyOptions` | projectId, variantId, layerId, count (1 to 8), provider | — | tick | Built | FR-045 |
| `generation.cutOut` | projectId, variantId, layerId, provider, licenceConfirmed? | — | tick | Built | FR-307 |
| `brief.extract` | projectId, filePath (`.md`, `.markdown`, `.txt`), provider | — | deny | Built | FR-022 |
| `layer.updateMany` | projectId, variantId, updates[] of { layerId, patch } (1 to 100) | V | allow | Built | FR-061, FR-092 |
| `generation.startVideo` | projectId, variantId, prompt, durationMs, provider, start (`none`, `background` or `first_frame`), useReferences: boolean, referenceAssetIds[], licenceConfirmed? (S2-4); user only: layerId? (the background layer; the clip then takes the still's place, R2E-7) | — | tick | Built (ComfyUI; fal.ai Seedance since P7-15) | FR-123, FR-199, FR-286 |
| `job.retry` | projectId, jobId, licenceConfirmed? (S2-4) | — | deny | Built | FR-069, FR-152 |
| `job.cancel` | projectId, jobId | — | tick | Built | FR-152, FR-215 |
| `job.markSeen` | projectId, jobIds[] (at least one) | — | deny | Built | FR-218 |
| `storage.dropboxSignIn` | — | — | deny | Built (P9-5) | FR-160, R-15 |
| `storage.dropboxSignOut` | — | — | deny | Built (P9-5) | FR-160 |
| `storage.checkS3` | `{}`. Tests the saved S3 settings and keys: list, put, read and delete one small test file; replies with ok or one fixed failure sentence (`spec/storage-and-publish.md`) | — | deny | Built (AP-10b) | — |
| `export.run` | projectId, campaignId, variantIds[], outputDir, imageFormat, jpgQuality, fps, proceedDespiteWarnings, reason? (FR-236) | — | deny | Built (P8-5) | FR-140, FR-199, FR-236 |
| `publish.run` | projectId, campaignId, storage, replaceConfirmed, proceedDespiteWarnings, proceedReason? (`spec/phases/phase-09.md`) | — | deny | Built (P9-10) | FR-161, FR-199 |
| `publish.setFontConsent` | projectId, assetId, allowed, sha256 (needed when allowed) (A-260) | — | deny | Built (P9-9, P9-12) | — |
| `history.undo` / `history.redo` | projectId, scope (`variant:{id}` or `campaign:{id}`) | — | deny | Built | FR-095 |
| `settings.update` | patch of settings | — | deny | Built | FR-067 |
| `secret.set` | name, value | — | deny | Built | FR-170, FR-198 |
| `secret.delete` | name | — | deny | Built | FR-170, FR-198 |
| `mcp.setEnabled` | enabled | — | deny | Built | FR-191 |
| `mcp.regenerateToken` | — | — | deny | Built | R-04 |
| `agent.answerPermission` | requestId, allow, rememberAuto | — | deny | Built (P10-6) | FR-197 |
| `comfy.setAddress` | address (text or null) | — | deny | Built | FR-251 |
| `comfy.check` | — | — | deny | Built | — |
| `agentRuns.setAllowed` | provider, allowed | — | deny | Built | FR-279, FR-280 |
| `agentRuns.setLimit` | limit | — | deny | Built | — |
| `dev.comfyExtend` | projectId, assetId, width, height, prompt | — | deny | Not built, and not to be built: `generation.runFill` replaces it (CU-8 is dropped under OI-64's assumption) | — |

The registry on `main` is `src/main/core.ts` (one spread line per domain). `src/main/commands/storage/index.ts` is empty; the Dropbox schemas exist in `src/shared/schemas/commands/storage.ts`. `history.undo` and `history.redo` are dispatched by the bus itself (`src/main/commands/history/run-history.ts`).

## Project and subject commands

Built. `src/main/commands/project/`, `src/main/commands/subject/`.

- **`project.create`.** `name` is 1 to 100 characters after trimming, because it becomes the file name. It may not hold `/ \ : * ? " < > |` or a control character, may not start or end with a dot, and may not be a name Windows reserves: `CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM¹`–`COM³`, `LPT¹`–`LPT³`, `CONIN$`, `CONOUT$`, in any letter case. The list is shared with the storage path rules (`spec/storage-and-publish.md`). `location` is an absolute folder path. Schema: `src/shared/schemas/project-name.ts`.
  - **How a reserved name is matched.** Windows looks at the part of a file name before its first dot, so `CON.backup` is reserved too. Take the trimmed name, cut it at the first dot, drop spaces from the end of that part, and compare it with the list in any letter case. `CON`, `con.backup`, `Aux.2026.final` and `NUL .x` are refused. `CONTACT`, `Icon`, `My.CON` and `COM10` are allowed. Same rule on macOS, because a project made there must open on Windows. The refusal is `INVALID_INPUT`, from the schema.
  - `project.create` does not call `deps.jobs.projectOpened`.
- **`project.open`** on a file already open in this app returns the open project's summary and changes nothing, so the window shows its existing tab. Two paths are the same file when their real paths match (links resolved, letter case ignored where the file system ignores it). The test that opens the same file under a different letter case skips itself on a file system that tells letter cases apart; it runs on macOS and Windows CI. A different file whose `project_id` equals an open project's is refused with `duplicate_project`. The open-projects list is keyed by project ID, so two open files never share one.
  - When the file was not already open, `project.open` calls `deps.jobs.projectOpened(handle.projectId)` as the very next thing after `openNew` returns: no `await` or other call stands between the registry add and this call; `touchRecent` comes after. The promise is awaited inside a `try`. A failure is logged as one `warn` line (`event: 'job'`, `name: 'job.projectOpened'`, actor `system`, the project ID, `ok: false`, message "Jobs left running could not be settled.", `context.error` holding the error's name only) and the open still succeeds. When the file was already open, nothing is settled. The `job.updated` events of settling reach the window before the reply to `project.open` (`spec/jobs.md`, "Left-over runs on project open").
- **`project.close`** refuses with `jobs_running` while a job is queued or running, unless `runningJobs: 'stop'`, which cancels those jobs first (`spec/jobs.md`).
- **`project.setAssetsDir`** (two steps; handler `src/main/commands/project/set-assets-dir.ts`, logic `src/main/assets/assets-dir.ts`). It moves no file: the setting says where new managed files go. For each managed asset, if `{dir}/{assetId}.{ext}` is a regular file by `lstat` (a link with that name is left alone), the row's `abs_path` and `rel_path` are set to it with size, time and hash read again; otherwise paths stay. A managed row whose `id` or extension cannot form a path is left alone. `dir` must be a full path to an existing folder: not a full path `INVALID_INPUT`; any `stat` error `NOT_FOUND`; a file `INVALID_INPUT`. The command makes no folder. Refused with `jobs_running` while `deps.jobs.activeCount(projectId) > 0`, because a job writes a file and then adds its row, and both must see one folder. Writes `assets_dir_rel` and `assets_dir_abs`, naming both to the change recorder. Reply `{ assetsDir, repointedAssetIds }`.
- **`project.package`** (`spec/data-rules.md`, "Package project") has no `undoPrepare`: its own last step cleans up. Reply `PackageResult = { packagePath, fileCount, totalBytes, skippedAssetIds }`. It does not call `deps.jobs.projectOpened`.
- **No command renames an open project.** `writeMeta` is called with a name only when a project is made and on Package's own copy. A later command that renames a project must rule on Package in its own design.
- **`subject.create`** replies `SubjectCreated = { subjectId }`. `id` is 1 to 64 characters from `A-Z a-z 0-9 - _`.

## Asset commands

Built. `src/main/commands/asset/`, logic in `src/main/assets/`. Full rules for files, linking and the assets folder are in `spec/assets.md`.

- **`asset.import`** reply: `{ assetIds, reusedAssetIds, skippedCount }`. `assetIds` is one ID per imported or reused file, in input `paths` order (a folder's files sorted by relative path, compared by code point). `reusedAssetIds` holds each ID once, first-met order, naming assets in the project before the command; a reused asset keeps its library and subject. `skippedCount` counts skipped folder entries. A folder with nothing to import succeeds with empty lists. More than 500 files is `too_many_files`. Not built (S2-17, after slice WP): the reply gains `animatedAssetIds`, the imported or reused WebP assets whose `webpInfo(...).animated` is true.
- **`asset.relink`** (two steps). Works on any asset, missing or not. `newPath` must be a full path to a regular file: absent `NOT_FOUND`; a folder `INVALID_INPUT`; unreadable `file_not_readable`. The new bytes must be an accepted type of the asset's own `kind`, else `relink_kind_mismatch`. Different content is accepted. The row takes new `abs_path`, `rel_path`, `mime`, `byte_size`, `mtime_ms`, `content_hash`, `width`, `height`; `display_name`, `library`, `subject_id`, `origin` and the generation fields stay. After relink the asset is `linked`. No file is moved, copied or deleted. Reply `{ assetId, siblingIds }`; `run` checks each row again before writing.
  - **`relinkSiblings`** (security class). With `oldDir` and `newDir` the folders of the old `abs_path` and of `newPath`, every other asset that is `linked`, missing now, and inside `oldDir` at any depth gets the candidate at the same relative path under `newDir`. It is relinked only when the candidate is a regular file whose content hash equals the row's. Other content is left missing; non-matching siblings are skipped without error. A candidate never leaves `newDir`; a candidate outside it, or under a linked subfolder of `newDir`, is never hashed. Tests: `tests/integration/assets/asset-relink-siblings*.test.ts`.
- **`asset.remove`** leaves every file on disk, managed too. No command ever touches a linked file. Refused with `asset_in_use` when the asset is a layer's picture, a layer's font, a background clip, or in a rule set's required assets (`src/main/assets/in-use.ts`).
- **`asset.update`** refuses only a move into the `reference` library while the asset is in use (`asset_in_use`). An asset already there and in use can still have its other fields changed.
- **`asset.checkChanged`** is a system command, `internal: true`, input `{ projectId }`, not undoable, bumps no `rev`. The app sends it after a project opens and when a window gains focus, with actor `user`: `internal` keeps the window out, the policy row keeps the agent out. Its own log lines say `system`; the bus's log line and `project.changed` say `user` (accepted; revisit if the activity log is ever shown to users as "who did what"). Reply `{ assetIds }`, the assets whose content hash changed. After a non-empty reply the app emits `asset.changedOnDisk`. Handler `src/main/commands/asset/check-changed.ts`, logic `src/main/assets/check-changed.ts`.
- **`asset.addGenerated`** is how a finished picture or video run adds its files. The runner first writes each file into the assets folder with `AssetService.writeManaged`, then sends this command with the new asset IDs. `prepare` reads size, hash and picture size from each file; `run` inserts the `asset` rows with `origin = 'generated'`, `storage = 'managed'`, `library = 'asset'`, `gen_run_id = jobId`, and the provider and prompt from the job row, and names them with `touch`. `model` is `input.model ?? job.model`: for ComfyUI the shipped workflow's main model file name, for Gemini the job's model, for the fake provider its own name. `ext` matches `^[a-z0-9]{1,10}$`. The input holds no path and no file contents. A bad file name is `INVALID_INPUT` "A generated file has a name the app cannot use."; an unknown job is `NOT_FOUND` "That job was not found."

## Brief and campaign commands

Built. `src/main/commands/brief/`, `src/main/commands/campaign/`, `src/main/commands/rule-set/`. Brief rules are in `spec/brief-and-templates.md`.

- **`brief.parse`** takes `filePath` or `text`, not both ("Give a file path or text, not both."). It reads any path the window sends, with no tie to the file picker; the policy denies it to an agent. A file name ending in anything but `.json`, `.yaml` or `.yml` is `brief_type_not_supported`. A missing file is `NOT_FOUND` "That file was not found." `text` is read as JSON, YAML or Markdown by fixed rules (`parseBriefText`). Reply `BriefParsed = { draft, primaryLanguage, subjectPictures }` (`src/shared/schemas/commands/brief.ts`; pictures checked as `spec/subject-photos.md` says, D-100).
- **`campaign.createFromBrief`, `campaign.createFromBriefWithFiles`** (R2P-7): one handler, two names, so the policy table stays fixed; the MCP tool `create_campaign_from_brief` picks the name by reading the text. Each refuses a brief of the other kind (`brief_names_files`; `no_files`). Order, refusals and reply: `spec/mcp-and-agents.md`, "Notes on single tools", and `spec/phases/round-2-platform.md`, D6.
- **`asset.importFiles`** (R2P-5, R2P-5b): an agent's import of files by full path, always asked. Rules: `spec/security.md`, "Rules: agents and cost"; design: `spec/phases/round-2-platform.md`, D5. Reply `{ assetIds }`.
- **`project.createInDefaultFolder`** (R2P-8): `project.create`'s work with the default folder. A file name is never replaced or followed: `project.create` and this command both refuse any entry at the name, a dangling link included (`RULE_VIOLATION`, `file_exists`). Reply `{ projectId, name }`. A relative path must be refused with `INVALID_INPUT` "The file path must be absolute." before any read: Not built (pending F-2).
- **`campaign.create`** with actor `user` is called only after the confirm form [REQ: FR-023]. With actor `agent` it takes the same structured input and no form is shown [REQ: R-01]. It creates the campaign, its rule set, one direction named "Direction 1", and one master variant at the first size in the primary language, with a background layer and one layer per filled slot. The headline layer's copy is the campaign message, word for word [REQ: FR-043]. `subjectMap` has one entry per brief subject; `ruleSet` and `copyRuleSetFrom` are not both given; size labels differ. Reply `CampaignCreated = { campaignId, directionId, variantId }`.
- `campaign.create` is not undoable for either actor [D-010]. A campaign that is not wanted is removed with `campaign.delete`; for an agent that is a delete, not an undo.
- **`campaign.update`** [REQ: FR-031, FR-032]. `languages` and `sizes` use the schemas of `campaign.create`. The input is strict: an unknown key is `INVALID_INPUT`.
  - `primary_language` never changes. The new `languages` list must hold it, in any place. A right-to-left language is refused as in `campaign.create`; this check runs before the primary-language check.
  - The new `sizes` list must hold, for the master of every direction, an entry with the master's `size_label` and the same width and height.
  - The command changes the two lists on the campaign row and nothing else. It adds, removes and changes no variant, and does not rewrite the stored `brief`. Making variants from the lists is fan-out (Phase 5). What happens to a non-master variant whose language or size leaves the list is OI-71 (open: whether it is removed, kept or marked); until it is answered the variant stays as it is.
  - Undo goes through the same list checks and puts back both lists with the text fields.
- **`campaign.delete`** by an agent asks for every campaign, including one the agent created (`campaign.created_by = 'agent'`) [D-023]. It is not undoable for anyone. It refuses with `jobs_running` while a job is `queued` or `running` whose `campaign_id` is the campaign or whose `variant_id` is one of its variants; the refusal runs before any write. It stops no job itself and has no "stop them first" input. Provisional until OI-69 (whether a campaign delete may stop its running work) is answered.
- **Deletes and undo.** `variant.delete`, `direction.delete` and `campaign.delete` are not undoable for anyone [D-099, which replaces the delete part of R-17]: the screen shows a warning dialog first, and an agent's `variant.delete` or `campaign.delete` asks the user, because FR-197 names them as destructive.

## Editing commands

Built: `layer.create`, `layer.update`, `layer.updateMany`, `layer.delete`, `layer.restore`, `layer.reorder`, `layer.reportOverflow` and `variant.update` (title) (`src/main/commands/layer/`, `src/main/commands/variant/`). The rest Not built (Phases 5 to 7, per row). Formats in `spec/data-rules.md`.

- **Phase 5 commands** (`direction.*`, `variant.fanOut`, `add`, `delete`, `remove`, `restore`, `restoreLayers`, `layer.clearOverride`, `layer.revert`, `sync.apply`, `generation.runFill`, `generation.applyFill`): inputs, rules, refusals, replies and inverses are in `spec/links-and-sync.md`. From Phase 5 an edit on a linked layer also adds override paths there.
- **Layer commands and `variant.update`**: inputs, counters, the no-op rule, undo inverses, the asset checks, refusals and replies are in `spec/editor-commands.md`. Every one of them except `layer.reportOverflow` bumps `variant.rev` through `src/main/commands/variant-rev.ts`.
- `variant.setFormat` works in both directions and an agent may run it without the permission dialog [D-020, D-025]. Defined in `spec/data-rules.md`, "Changing a variant's format".
- `translation.set` on a language variant writes the text with `translation_status = 'proposed'`. `translation_source` is `user` or `agent` by actor. An agent can never approve [REQ: FR-200]. With `applyToSameLanguage` the same text is written to the matching layer of every variant in the direction with that language and no `copy` override.
- `translation.approve` is the only way a status becomes `approved`. Editing an approved translation sets it back to `proposed` [REQ: FR-101].
- `layer.update` by an agent on a master bumps `revs` like any edit, so linked variants become out of date and nothing cascades [REQ: FR-200].
- An agent may pick a generated result: `layer.update` and `layer.create` by an agent make no check of `started_by` or `seen_at`. "Encouraged not to" is wording in the MCP tool descriptions, never a refusal.
- `layer.reportOverflow` is not internal: the editor window sends it.
- `export.run` gains an optional reason for proceeding past warnings [REQ: FR-236] (`spec/export-and-checks.md`).

## Generation and job commands

Built: `generation.runImages`, `generation.startVideo`, `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut`, `job.retry`, `job.cancel`, `job.markSeen`. `src/main/commands/generation/`, `src/main/commands/job/`. Job rows and the runner: `spec/jobs.md`. ComfyUI checks: `spec/comfyui.md`. Cancel: `spec/cancel.md`.

- Every `generation.*` command and `job.retry` return `JobStarted = { jobId }` as soon as the job row exists.
- Every caller of `enqueue` says who started the run: `EnqueueRequest.startedBy` is required, `'user' | 'agent'`, no default.
- **Deferred agent abilities** [REQ: FR-199]. Opening `export.run` or `publish.run` to agents is a change to `agent-policy.ts` plus the MCP tool definitions. No command changes. The generation commands and `job.cancel` are `tick` [D-051, D-052, D-080], the Phase 4 ones included (`spec/ai-jobs.md`).
- The Phase 4 commands (`generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut` in `src/main/commands/generation/`, `brief.extract` in `brief/extract.ts`, `layer.updateMany` in `layer/update-many.ts`) are built and described in `spec/ai-jobs.md`.

### `generation.runImages`

- Records `layerId` in `job.layer_id` when given a layer, and `slot` in `job.slot` when given a slot. It accepts any image or background layer of the variant by `layerId`, not only one that fills a template slot. The screens offer it: the picture section is shown for every image and background layer, and the cut-out for any such layer with a picture (Q-032 answered yes, A-26; `spec/screens-ai.md`).
- **The shape asked for** (OI-70; Built, P4-13). Given a layer, the request's `width` and `height` are the layer's box (`geometry.width` and `geometry.height`, rounded, at least 1), so less of the picture is cropped when it is placed; a background layer's box is usually the whole canvas. Given a slot, the variant's size, as built. A provider takes these as a shape (Gemini's nearest ratio, ComfyUI's `fitSize`).
- `count` is a whole number from 1 to 8. Each picture is one paid call. The number has one owner: `MAX_IMAGES_PER_RUN` in `src/shared/config/defaults.ts`, read by the schema in `src/shared/schemas/commands/generation.ts`. The default stays `settings.generation.optionsPerRun` (4).
- Refusals: an unknown provider, one that cannot make pictures, or one not in this build: `INVALID_INPUT`. A text layer, a copy slot or an unknown slot: `INVALID_INPUT`. A missing variant, or a layer not in the variant: `NOT_FOUND`.
- `prepare` reads every ID in `referenceAssetIds`: a picture that is gone, too large or not a picture (WebP included, until slice WP) is refused before a job row is made. The job kind reads the bytes again with `AssetService.read`.
- At most `MAX_REFERENCES_PER_RUN` (8) references per run, one constant in `src/shared/config/defaults.ts`, used by this schema, the job request schema and the pickers, with duplicate IDs refused (A-56).
- For `comfyui`, before any job row: `comfy_address_needed`, then `comfy_job_not_offered`, then `too_many_references` (`checkComfyRun`, `src/main/commands/generation/comfy-checks.ts`). The command picks the workflow itself through `offeredWorkflow` (`spec/comfyui.md`): a `proven` one, else a `trial` one only when `deps.devTools` is true. The same rule holds for both actors. No agent sets a workflow's status to `proven`.

### `generation.startVideo`

Checks in `prepare`, before any job row:

1. Provider, variant, keys. A provider whose `available` is false or that lacks `video` in `jobs` is `INVALID_INPUT` "That provider cannot make videos." A missing variant is `NOT_FOUND` "That variant was not found."
2. `startPair(input)` (`src/main/commands/generation/start-pair.ts`) gives the start its `videoStart`. `INVALID_INPUT` "Choose one picture for this video." for `first_frame` with no ID, `useReferences` true with no ID, IDs with `none` and `useReferences` false, or more than one ID on `first_frame`. `RULE_VIOLATION` `comfy_job_not_offered` for `first_frame` with `useReferences` true.
3. For ComfyUI, `checkComfyVideo(deps, ctx, durationMs, videoStart)`: the address (`comfy_address_needed` first), then `offeredWorkflow({ job: 'video', videoStart }, { devTools, actor })` else `comfy_job_not_offered`, then that workflow's `maxMs` (`video_too_long`). The `too_many_references` refusal comes after this step, because the most comes from the workflow.
4. The picture. `picture_not_usable` is checked from the asset row first (a video asset included): kind `image`, type PNG, JPEG or WebP. Then `deps.assets.read(ctx.project, id)` refuses a picture that is gone, too large, unreadable or not convertible to PNG, as `generation.runImages` does.

| Start | `start` | `useReferences` | `referenceAssetIds` | `videoStart` |
|---|---|---|---|---|
| From a prompt | `none` | false | `[]` | `{ firstFrame: false, references: false }` |
| From a first-frame picture | `first_frame` | false | `[assetId]` | `{ firstFrame: true, references: false }` |
| With a reference picture | `none` | true | `[assetId]` | `{ firstFrame: false, references: true }` |

- Every provider other than ComfyUI accepts only the prompt start.
- Until the Scene exists, the first frame is the chosen picture asset. Phase 7 uses the rendered background.
- A video on a picture-format variant is accepted until Phase 7; Phase 7's format switch adds that refusal.
- `workflowId?` on `generation.runImages` and `generation.startVideo`: Not built (CU-8). A workflow from the fixed list, accepted only when `deps.devTools` is true and the actor is the user; otherwise `INVALID_INPUT`. The parse drops it today as an unknown key.

### `job.retry`

- Makes a new job row from the old row's `request` (a picture job that kept pictures asks only for the rest, `spec/jobs.md`), references included, with the same campaign, variant, layer and slot, and leaves the old row as it is. It applies to a `failed` or `cancelled` job; a row with no provider is refused with `job_wrong_state`. It calls the key guard again (purpose "try this again"). A retried job is always `startedBy: 'user'`. Agents are denied it, because it re-sends a stored request.
- **ComfyUI checks** (`src/main/commands/job/retry.ts`). For a ComfyUI picture job it calls `checkComfyRun` with the reference count from `old.request`, after the key guard and before `enqueue`. For a ComfyUI video job, `checkComfyVideoRetry` reads the stored start pair and makes checks 2 to 4 of `generation.startVideo` against the old row's IDs, for every status of the old row. The chosen workflow is not stored on the job row. Tests: `tests/integration/commands/job-retry-comfy.test.ts` (on a made-up trial copy of the shipped list; dev tools off with only `trial` workflows: refused `comfy_job_not_offered`, job count unchanged; dev tools on: a new queued job; the same for a video row).
- Pending: checks 2 and 4 (start pair, picture) for every video provider, not only ComfyUI, with one test.

### `job.cancel`

- Applies to a `queued` or `running` job. A call already sent may still be charged; `paid_calls` keeps its count. Refusals are decided in the command and again in the runner, both through `cancelRefusal` (`src/main/jobs/cancel.ts`). The runner cancels after the command's transaction ends; the window follows the job through `job.updated`. Reply `{ jobId }`.
- If the job ends between the command and the cancel, one `warn` line is logged: "The job ended before it could be cancelled."
- An agent may cancel only a run it started (gate rules in `spec/agent-runs.md` and `spec/mcp-and-agents.md`).

### `job.markSeen`

- Keeps its checks (`NOT_FOUND`, `job_wrong_state`) and calls `deps.jobs.markSeen`; it holds no SQL. The runner's `markSeen(ctx, jobIds)` runs one `UPDATE` per ID setting `seen_at` and `updated_at` where `seen_at` is null and `status` is `succeeded`, inside the command's transaction. After the command ends it emits `job.updated` for each row that changed. Marking again gives no event and no error. A call naming one succeeded and one failed job is refused, marks neither and emits nothing. It bumps no `rev`.
- Stays deny for an agent: picking a result does not mark it looked at.

## Settings, keys and agent access

Built unless marked. `src/main/commands/settings/`, `secret/`, `mcp/`, `comfy/`.

- **`settings.update`** takes a partial `Settings` (`spec/infra-and-settings.md`, "settings.json") and refuses unknown keys with `INVALID_INPUT`. Keys not in its schema, each with its own writer: `recentProjects` (`project.create`, `project.open`), `mcp.enabled` (`mcp.setEnabled`, which also starts or stops the server), `comfyui` (`comfy.setAddress`), `agentRuns` (`agentRuns.setAllowed`), and `agentRunLimit` (`agentRuns.setLimit`).
  - `defaultProviders.image` set to a provider whose registry row is not available is `INVALID_INPUT`.
  - An S3 region is checked when saved (`storage_not_supported`).
  - A change of `mcp.port` while the server runs closes the listener, drops open sessions and listens on the new port. The port is saved either way; the command is not refused and never throws for it.
- **`secret.set`** saves a key without testing it [REQ: FR-172]. `name` is a user secret name (`USER_SECRET_NAMES`, every name but `mcp.token`); `value` is trimmed and not empty ("Enter a key."). A saved key's summary holds its last four characters; a key of four characters or fewer shows none [REQ: R-10]. `secret.delete` takes `name` only.
- **`mcp.setEnabled`** and **`mcp.regenerateToken`** set `changesAppState`. Neither reply holds the token. `mcp.setEnabled(true)` on a taken port leaves the setting as it was and refuses with `port_in_use`. `mcp.regenerateToken` makes a token and, if the setting is on, starts the server; with the port taken it saves the token and refuses with `port_in_use`. Full server rules: `spec/mcp-and-agents.md`.
- **`comfy.setAddress`** is the one writer of `settings.comfyui.baseUrl`. Refuses with `INVALID_INPUT` and one of the `address_*` reasons [REQ: FR-251]. Contacts nothing. Sets `changesAppState`. Reply `{ baseUrl }`, the clean origin; `http://@host:8188` (empty user part) is accepted and stored as the clean origin.
- **`comfy.check`** (`spec/comfyui.md`, "The check"). Returns `ComfyCheck = { outcome, version?, note?, workflows: [{ id, missing }] }`. No address saved is `comfy_address_needed`. Writes nothing.
- **`agentRuns.setAllowed { provider, allowed }`**. The one writer of `settings.agentRuns`. App scope, not undoable, sets `changesAppState`, returns `{ provider, allowed }`. Unknown provider: `INVALID_INPUT`. A provider `agentRunsOffered` refuses: `RULE_VIOLATION`, `details.reason` the value it gave, message "Agents cannot start runs with {Provider}." `allowed: false` is always accepted.
- **`agentRuns.setLimit { limit }`**. The one writer of `settings.agentRunLimit`: a whole number 1 to 16, default 4 (`AGENT_MAX_ACTIVE_RUNS`, bounds in `src/shared/config/agent-runs.ts`). App scope, not undoable, sets `changesAppState`, returns `{ limit }`. Out of range is `INVALID_INPUT`. Policy row `'agentRuns.setLimit': deny('change agent run limits')`.
- **`agent.answerPermission`** (built, P10-6): answers an `agent.permissionRequested` event (`spec/mcp-and-agents.md`).

## Storage commands

Built (P9-5, with the hardening P9-5b), with `storage.setDropboxFolder`. Schemas in `src/shared/schemas/commands/storage.ts`. Full rules: `spec/phases/phase-09.md`.

- `storage.dropboxSignIn` runs the browser sign-in of `spec/storage-and-publish.md`: it starts the listener on `127.0.0.1:47822`, opens the system browser, waits up to 5 minutes for the redirect, saves `dropbox.refreshToken` in the secrets store and writes `settings.storage.dropbox.accountName`. It returns `DropboxSignInResult = { accountName }` and never the token. It sets `changesAppState`. Opening the browser uses the `openExternal` option of `createCore` (`spec/structure.md`). A second sign-in while one waits is `sign_in_in_progress`.
- `storage.dropboxSignOut` deletes the token and sets `settings.storage.dropbox` to null.

## Hand-test commands (`dev.*`)

`dev.storage` was removed in P9-14; the `dev` group is empty. `dev.comfyExtend` was never built; its policy row stays. See `spec/api-dev-commands.md`.
