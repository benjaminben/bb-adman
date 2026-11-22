# Design wave: things to verify

A running list kept by the orchestrator, like `round-2-verify.md`. The design wave builds the design audit you approved on 2026-11-22 ("Good to roll with the auditors recommendations as another wave"). Its plan is `spec/phases/design-wave.md`; the system is in `spec/app-style.md` and `spec/app-style-parts.md`.

## Choices taken so no slice waits on you

1. **The eighteen open choices of the audit (C-1 to C-18)** are taken as the auditor recommends. They are written as rules at the top of the plan.
2. **Paid runs (C-15).** The separate "Run this generation?" step goes. In the run dialog and the fan-out dialog, the dialog's own button is the click that pays: the cost line sits right above the buttons, and nothing is sent before that click. Where a paid action starts from a place you did not open in order to pay (the sync review's Translate, a Retry in Activity), the two-step confirm stays.
3. **New marks** (a dot on a settings page that needs a look, running and new marks on campaign tiles, "Needs storage" on the approvals row) are built, using data the app already has.
4. **No new data is stored for marks in this wave.** So there is no "never checked" mark, a connection test's result is not kept after you leave the page, and brief problems stay in one list at the foot of the form.
5. **A tile's title** moves to its tooltip only when every tile in the direction has the same title.
6. **The agent access token** is folded away and drawn masked, with "Show" and "Copy".
7. **The slot view leaves the campaign page** with the old "Make pictures" panel and "Runs" list; the editor's layers panel and Generate panel do their job.
8. **First-run setup** gets one welcome sentence and a strip of step icons.
9. **The paid count** on a campaign shows as a short mark, with the full sentence in its tooltip.
10. **The local image server's privacy paragraph** stays on the page in full. The audit wanted one short line with the rest behind an info button; say if you want that.
11. **Security words stay on the page everywhere:** money, lost work, data leaving the machine, what an agent asks to do, and failures are never folded away or moved into a tooltip.

12. **Leaving the New campaign page** with Back or Escape asks first when you have typed something ("Leave this brief?"); the Cancel button leaves at once, as today.
13. **Things the audit proposed that were not built, because they would change how a feature works** (they can be planned separately): a subject name field that both picks and makes a subject; a subject menu drawn as avatars; a size-by-language grid inside the fan-out dialog; run results shown inside the run dialog.
14. **Where the audit wanted a security or failure line folded away, it stays on the page:** the permission, licence and delete dialogs keep every word; the local image server's privacy paragraph; a failed approvals refresh; a failed translation; brief photo notes; what Publish sends and writes into its report; the export overwrite line; what turning off an approval link deletes.

15. **Two address fields keep their Save button** (the local image server and the approvals service), because they decide where your prompts and pictures are sent. Other single values (port, export folder, numbers) save when you press Enter or leave the field.
16. **A workflow that needs a commercial licence** shows a short "Commercial licence needed" mark in Settings, with the detail behind an info button. The question you asked for at run time is unchanged.
17. **Layer order:** "Bring forward" and "Send backward" move into the layer row's "⋯" menu, with Duplicate and Delete.
18. **One short line per storage service stays visible** saying where data goes (your own bucket, your Dropbox, the approvals service).
19. **Four Settings values save by themselves:** the agent access port, the Dropbox folder, JPG quality and the report name save when you press Enter or leave the field, and show "Saved" for two seconds. A value the app refuses stays in the field with its message. Clicking the agent access switch straight after typing a port saves the port first; that first click does nothing, so click again.
20. **Leaving Settings:** the Settings button, Escape, the ✕, a click on a campaign tab and "+" all leave. Escape does not leave while a dialog, a menu or a help popover is open, or while a key you are typing sits unsaved in its field. A typed key that is not saved is dropped when you leave, as before. While Settings shows over a project, the project menu reads "AdManager" and the campaign tab you came from still looks selected.
21. **Picture panel:** an empty background still shows "Fill the canvas" and "Fit inside". A colour that is not one of the palette's swatches shows as an extra first swatch, so the current colour is always visible.
22. **Subject cards:** "File not found" stays written on a photo whose file is missing. In the Assets panel the photos are small (four a row); the brief form will use the larger size.
23. **The run dialog.** The dialog's own button ("Generate", "Retry", "Cut out"…) is now the one click that pays; the separate "Run this generation?" step is gone. The cost reads, for example, "Paid: 4 pictures + 2 references → Google Gemini", directly above the buttons. A separate security review found nothing blocking. Choices made on the way:
    - A provider that cannot be used shows only its name; the reason ("Not yet available", "No workflow for this yet") is in its tooltip.
    - A retry still shows "Provider: …" and "Pictures: …" as plain text, not as greyed-out controls.
    - A retry whose saved request cannot be read says "Paid: pictures → …" with no number, never a guessed one. A run with no saved provider reads "an unknown provider" and counts as paid.
    - "Translate" in the sync review and Retry of a video in Activity keep two clicks: the first shows the cost, "Confirm" sends.
24. **Assets panel.** Groups fold and show their count. Pictures are a two-column grid; the words "Made with AI", "Linked" and "Reference only" are now icons with tooltips. The subject of a picture is still a drop-down under it.
25. **Fan-out and copy options.** "Make n variants" is the one click; the cost lines sit directly above it ("Paid: 2 fills → …", "Paid: up to 3 translations → …"). A separate security review found nothing blocking. Choices made on the way:
    - The fill count is now exact: a size is counted only when this run makes its first variant in the master's language. The old line could show more fills than were sent.
    - After the click, at most as many fills are started as the line showed. If the direction changed in that moment and the app asked for more, the extra ones are not started; you can fill those variants afterwards.
    - The last format left on cannot be turned off.
    - Copy options no longer opens a second dialog: provider, count, cost and "Generate" are in the same dialog. To use an option, choose its tile, then "Use".
26. **Project home.** The page's own "Close project" button and Package card are gone; both are in the project menu at the top left. The project's file path shows only as the title's tooltip. Missing files show as a small "3 missing" mark you can click.
27. **Start screen.** There is no top bar on it. "New project" turns into one row: name, a folder button whose tooltip names the folder, and "Create". Escape closes the row even with a name typed.
28. **Variant tiles.** A tile is its picture plus a strip of small icons; the words ("Out of date", "Translation not approved"…) are tooltips. A tile's title shows only when titles differ within the direction. Clicking a mark goes where it points: "Check warning" to Checks, "Running" to Activity, "File missing" to the relink dialog. Reviewer emails show only in the sign-off popover.
29. **Close questions.** Closing a tab or project with tasks running asks with "Keep open" (focused) and "Stop and close". The close questions inside the copy options and brief reading dialogs keep their one sentence.
30. **Generate panel.** "Make" (Picture or Video) shows on every picture layer; where a video cannot be made, "Video" is greyed and its tooltip says why. The start choices are tiles; long tile names break across lines with a hyphen in the narrow panel.
31. **Activity panel.** A row reads "{what} · {provider}" with the time and place under it (the plan had them the other way round; this order kept the time from being cut off). A failure keeps its sentence under the row. An empty "Running" list is hidden, not shown with a 0.
32. **Tile and direction actions.** A tile has an eye (quick look) and a "⋯" menu: Open, Open in a tab, Quick look, Delete…. A direction's "⋯" holds New direction…, Rename…, Delete direction…. "Nothing to sync" is gone; "Sync n" shows only when something is out of date. A tile's "Out of date" mark opens the sync review. Deleting still asks first, with "Keep" focused. The hint about click and double-click is now behind the small ⓘ beside the first direction's name.
33. **New campaign page.** The brief form is its own page with a Back arrow and buttons that stay at the bottom. Back or Escape asks "Leave this brief?" only when you changed something; a brief you loaded and did not touch leaves at once. Photos the brief added are removed on leaving, as Cancel always did.

## Hand checks only you can do

- Read the new Settings pages once with your real keys saved: nothing should need setting up again.
- Start one paid run from the editor and one from fan-out: the cost must be on screen at the click.
