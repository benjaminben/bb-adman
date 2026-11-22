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

## Hand checks only you can do

- Read the new Settings pages once with your real keys saved: nothing should need setting up again.
- Start one paid run from the editor and one from fan-out: the cost must be on screen at the click.
