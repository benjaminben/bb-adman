# Subject delete (SUBJ-1)

One slice, asked for by the stakeholder (D-101): a person can delete a subject in the screens, and an agent can delete one through MCP. Every developer reads `spec/phases/DEV-RULES.md` first.

## What exists

- The command `subject.delete` (`src/main/commands/subject/subject.ts`) is built. It is refused with "This subject is used by a campaign. Remove it from every campaign first." while a campaign or a variant uses the subject. A photo attached to the subject keeps its row and loses the subject. It is not undoable.
- No screen sends it. Its agent policy is `deny`.

## What changes

### The screens

- **Subject card** (`src/renderer/screens/assets/subject-card/`): a second `.iconButton` in the card's head, after the pencil, with the `trash` icon, `aria-label` and `title` "Delete {name}".
- **The dialog** (new folder `src/renderer/dialogs/delete-subject/`): `DialogFrame` with `kind="confirm"`, built like `dialogs/delete-variant/`.
  - Title: "Delete {name}?".
  - Body, also the dialog's accessible description: "This cannot be undone." When the subject has photos, a second sentence follows: "Its photo stays in the project without a subject." for one, "Its {n} photos stay in the project without a subject." for more.
  - Foot: "Keep" (`.quiet`, focused when the dialog opens), then "Delete subject" (`.primary.danger`, the busy spinner inside it).
  - Nothing is sent before the click on "Delete subject". The click sends `subject.delete` once; both buttons are disabled while it runs.
  - A refusal is a danger `DialogAlert` at the top of the body with the command's own message, and the dialog stays open.
  - On success the dialog closes; the card goes because the subject list is read again on the change event.
- No undo, and no "undo" wording anywhere (D-099).

### Agents

- `subject.delete` policy becomes `ask('delete subjects')` in `src/main/commands/agent-policy.ts`. `subject.create` and `subject.update` stay `deny`.
- `ASK_KINDS` (`src/main/mcp/ask-kinds.ts`) gains `'subject.delete': 'delete'`. So it is asked on screen like the other deletes, and the user's "Don't ask again for deletes" tick covers it as it covers campaign and variant deletes.
- The target line (`src/main/mcp/ask-target.ts`): `Subject "{name}" ({n} photos) in "{project}"` ("1 photo" for one, "no photos" for none). Names pass the shared name cleaner. No ID and no path. A subject that is not found gives `NO_TARGET`.
- The consequence line in the permission dialog (`COST` in `permission-dialog.tsx`) for the action `delete subjects`: "This cannot be undone. Its photos stay in the project without a subject." It is the last line of the body and in the accessible description, as for the other deletes. This is the only change to the permission dialog; no other word of it changes.
- New tool `delete_subject` in `src/main/mcp/tools/delete-tools.ts`: input `project_id`, `subject_id`; the reply is the subject ID only. Description: "Delete a subject of an open project. Its photos stay in the project without a subject. A subject that a campaign uses cannot be deleted. This cannot be undone. The user is asked in the app, and this call waits up to two minutes for the answer. A refusal is final: do not ask again for the same subject unless the user tells you to."
- The in-use refusal reaches the agent as the command's own error after the user allowed; it holds no path.

## Security

Full: a separate read-only review before the merge. The reviewer checks:

- An agent's `subject.delete` never runs without the on-screen allow, or the user's standing tick for deletes; a refusal or two minutes without an answer runs nothing.
- The target line and the tool's reply hold names and the ID only: no path, no file name of a photo.
- `subject.create`, `subject.update` and every other `deny` row are unchanged.
- The delete removes the subject row only: no photo's file or row is deleted.
- In the screens nothing is sent before the click on "Delete subject", "Keep" has first focus, and Escape closes without sending.

## Tests first

- `tests/unit/renderer/dialogs/delete-subject.test.tsx`: the title; the two body sentences by photo count; "Keep" focused; nothing sent on open, on Escape or on "Keep"; one `subject.delete` on a double click; a refusal shown as an alert with the dialog still open; the description; axe clean.
- `tests/unit/renderer/screens/assets/subject-card-delete.test.tsx`: the card's "Delete {name}" button opens the dialog for that subject.
- Main: the policy row is `ask`; the ask kind is `delete`; the target line for no, one and many photos, with a name cleaned; an agent call that is refused deletes nothing; an allowed call deletes the subject and its photos keep their rows; a subject in use is refused after the allow; the `delete_subject` reply is the ID only.
- A permission-dialog test for the new consequence line.

## Approved edits to existing tests and documents

- `tests/unit/main/commands/agent-policy-table.test.ts` and any test that pins the count or the names of MCP tools or of `ask` commands: the one new row or name.
- `spec/api-commands.md` (the `subject.delete` row: `ask`), `spec/mcp-and-agents.md` (the tool table gains `delete_subject`, and one bullet beside `delete_variant`), `spec/security.md` where it lists what an agent may delete.

## Shots

`tests/shots/subj-1.shots.ts`: 500 the Assets panel with a subject card showing both buttons; 501 the delete dialog for a subject with photos. Drawn fixtures only.

## Exit check

`npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/screens/assets tests/unit/renderer/app tests/unit/main tests/integration/campaigns tests/integration/mcp` (the folders that exist), `npm run build`, `npx playwright test tests/e2e/mcp-workflow.spec.ts tests/e2e/round-2-agent.spec.ts`, then the shots file.
