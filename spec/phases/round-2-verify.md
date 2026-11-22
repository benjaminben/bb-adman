# Round 2: things to verify before the next round of testing

A running list kept by the orchestrator. Each item is a choice made without the stakeholder so the build could go on. Tick it, or say what to change. Newest items are added at the end of each part.

## Choices that change what you see

1. **Start screen pictures.** All ten generated pictures are used as made, except number 3, which was redone so it has one pink sheet, as the art direction asks. Shipped at 1152 × 1440 px as WebP. Swap any of them by replacing the file of the same name.
2. **Signing off a video without playing it is allowed.** The gallery asks in words to watch it first and does not lock the button. The other way (button locked until the video has played) needs a script in the page and can be got round. Planned as Q-V7 in `round-2-approvals-video.md`.
3. **Design audit choices C-1 to C-18** are taken as the auditor recommends (`design/DESIGN-AUDITOR-SPEC.md` section 5), built as their own wave after Round 2. The one that changes a current rule: C-15 folds the separate "Run this generation?" step into the run dialog, with the cost line right above the button. A paid call still starts only after your own click with the cost on screen.
4. **Grid row heads.** When a size has no name of its own, the row head shows the size once, not twice.
5. **The campaign page's "Make pictures" panel and "Runs" list** stay until the editor's Generate panel is built, then go in a later slice.
6. **"Same size" for starting a generation from another asset** means the same shape within 1%.
7. **Text contrast after "Place text with AI"** is held to 4.5:1 for all text sizes.
8. **Fonts.** Five built-in type styles from one family now; two or three more open-licence families later, picked by you.
9. **The "Master" badge is not read aloud** by a screen reader, because the tile's size line already ends in "master".

## Choices about approvals

10. **Reviewer email on a shared browser.** Entering the link's password again clears the email saved in that browser, so a later visitor does not see an earlier reviewer's email.
11. **A sign-off post saves the reviewer's email** for the browser session whenever the email is valid, whatever the result.
12. **"Sign off all" when one variant changed in the last moment:** the others are still signed; the changed one is not.
13. **Video in the gallery** (all planned to the recommendation):
    - Clips stream through the service. On the free Vercel plan that is about 220 full plays of a 30-second ad a month; watch the Usage page after the first real review.
    - A clip over 3 minutes or 384 MiB, or a machine without FFmpeg, sends the still alone with a note.
    - A clip that fails to export fails the whole "Update gallery".
    - No download button for clips.

## Choices about agents and briefs

14. **A brief sent by an agent that names a file path** asks you on screen, every time. A brief you paste or load yourself imports with no question.
15. **An agent importing files:** more than 20 files in one call is refused.
16. **Markdown briefs** are read by fixed rules (no AI). Edge cases chosen by the builder: a label inside a subject or a Copy section is ignored; an empty `Region:` sets nothing; the first value of a repeated field wins.
17. **Agent file import, hardening after review.** On Windows an agent may not name a network path (`\\server\share\…`), a device path, or a path with no drive letter; on every system a path with unusual space or line-break characters is refused. Each file is read through one open handle that follows no link, and the finished copy is compared with what was checked. Still not covered: a file whose bytes are swapped before you click Allow (you see only the path).

## Hand checks only you can do

- The Keychain entry and saved keys after the rename to AdManager.
- A double-click on a project file in Finder while the app runs under `npm run dev`.
- Video playback in the gallery in Safari and Chrome (the automatic tests may not be able to play H.264).
- Anything on Windows.
