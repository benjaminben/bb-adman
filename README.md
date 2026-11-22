# AdManager

AdManager is a desktop app for making ad campaigns. You give it a brief and pictures of your products or people. It makes one ad for each size and language, lets you edit every ad by layers, checks them, and exports the finished pictures and videos. It runs on your own computer, on macOS and Windows.

In code, file names and folders the app is called "Adman".

## What it does

- **Campaigns from a brief.** A brief names the message, the languages, the sizes and the subjects. The app makes a first ad and you fan it out to every size and language.
- **A layer editor.** Text, pictures, shapes and a background, with a timeline for video ads.
- **AI pictures and video.** Through Gemini, fal or your own ComfyUI server. Each paid run shows its cost before you start it.
- **Translations.** Typed by hand, proposed by AI, or loaded from a spreadsheet file.
- **Checks.** Brand and layout checks across a campaign, with a report.
- **Export and publish.** To a folder, an S3 bucket or Dropbox.
- **Approvals.** A small web gallery (`approvals-service/`) where a reviewer signs off each ad through a link with a password.
- **Agent access.** An AI agent such as Claude can build campaigns through the app's local MCP server.

## Install

Download the installer for your computer from the Releases page.

The installers are not signed, so each system asks once before the first launch:

- **macOS (Apple silicon).** Open the `.dmg` and drag AdManager to Applications. Open it once; macOS refuses. Then open System Settings, Privacy & Security, and choose "Open Anyway". On older macOS versions you can instead right-click the app and choose Open.
- **Windows (64-bit).** Run the installer. On the blue "Windows protected your PC" box choose "More info", then "Run anyway".

## Keys and what leaves your computer

- Every key is typed into Settings and stored encrypted by the operating system. The app reads no key from a file.
- A picture or prompt goes to an AI service only when you start a run for that service.
- Files go to your bucket or Dropbox only when you publish, and the publish dialog lists each file first.
- The ComfyUI server address is set in Settings. Prompts and the pictures a workflow needs are sent to that server and nowhere else.

## Agent access

Agent access is off until you turn it on in Settings, Agents. The page gives a line to copy into Claude Code and a block for Claude Desktop.

- The server listens only on this computer and needs the token shown on that page.
- An agent can make projects and campaigns, edit layers, start AI runs for the services you ticked, and read the results.
- An agent cannot read keys, change settings, export, publish or approve translations.
- Importing files and deleting things ask you on screen first.

## Build from source

You need Node 24 and Git.

```
npm ci
npm run dev
```

To run the built app:

```
npm run build
npm start
```

To make an installer for the computer you are on:

```
npm run fetch:ffmpeg
npm run package
```

`npm run fetch:ffmpeg` gets the FFmpeg that video export needs. On Windows it downloads a pinned build; on macOS it builds the pinned source, which needs the Xcode Command Line Tools. Each system builds its own installer: the Windows installer is made on Windows, the macOS one on a Mac.

## Tests

```
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

None of these calls a paid service or leaves the computer.

## Making a release

1. Set `version` in `package.json` and commit.
2. Tag that commit with the same number and push the tag: `git tag v0.1.0`, then `git push origin v0.1.0`.
3. The Release workflow builds the macOS and Windows installers and attaches them to a draft release.
4. Read the draft on GitHub and publish it by hand.

## Licence

No licence has been chosen, so all rights are reserved. Notices for the software the app ships with are in `THIRD-PARTY-NOTICES.md`.
