# Rules for a developer run

Every developer agent reads this file first. It holds what is the same for every slice.

## Where things are

- You work in your own git worktree, a copy of `main` at the moment you started. The main folder is the repository that owns your worktree.
- The spec is in git, so your worktree has it: `SPEC.md` (the index) and `spec/*.md`. Your brief names the files you need. Do not read the others unless a rule you need points there. Do not edit the spec.
- Dependencies are installed in the main folder. Node finds them from your worktree. Do not run `npm install` or `npm ci` unless your slice adds a package; if it does, say so in your report.
- Never read, print or copy `.env.local` or any key value. Tests that need a key read it themselves.
- Do not look in `.claude/worktrees/` other than your own worktree.

## How to work

- **Test first.** Write the failing test, see it fail for the right reason, then write the code. Keep tests next to the kind they are: `tests/unit/`, `tests/integration/`, `tests/e2e/`.
- **Existing tests are contracts.** Do not change one to make your code pass. You may change an existing test only where your brief or the phase file says the edit is approved (for example an import path that moves, or a count that grows by a named amount). List every existing test you changed in your report, with the reason.
- **Stay inside your slice.** Edit only the files your slice owns or must touch. If you find a bug elsewhere, report it; do not fix it unless it blocks you.
- **Assume and go on.** Where the spec is unclear and the choice is small, choose what fits the spec best, write the assumption down, and continue. Stop and return only when the choice is large: it changes stored data shape, a security rule, spends money, or would be costly to undo.
- **Code rules.** TypeScript, no semicolons. A source file aims for 200 lines and never passes 300 (large static data is exempt). Plain names. No dead code, no commented-out code.
- **Screens** (when your slice has any): one folder per component with its own CSS module, as `spec/structure.md` says. Every colour, space, radius and type size comes from the shared tokens in `src/renderer/ui/`. No raw colour or pixel value in a component's CSS. Components take data through props or a store and do not reach into each other, so one can be moved or restyled alone. Follow the wording rules in `spec/screens.md`.
- **Security scope.** Destructive actions, access to sensitive data and unexpected privileged access matter. A nuisance (a slow or frozen app, a refused file) is noted at most and never fixed unprompted. Follow `spec/security.md` for anything touching files, keys, network requests, the asset protocol or agents.
- **Paid calls.** Automatic tests never make a paid call. If your brief asks for one real-service proof, make exactly one run at the lowest-cost settings and report it. Do not repeat it.
- **The real ComfyUI server.** Never run `npm run test:comfy` or `npm run test:e2e:real` as a routine check; a real run takes minutes. Test ComfyUI behaviour against the stand-in. Run on the real server only if your brief asks for one proof of a new feature, once, at the smallest size and shortest clip.
- **Nothing leaves the machine.** No `git push`, no tag, no publish.

## Verify before you say done

Run, in your worktree, and paste the last lines of each into your report:

```
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:build
```

Run `npm run test:e2e` as well when your slice touches the renderer, the preload or the main-process start-up. A failing check that you did not cause is reported, with proof that it also fails on `main`.

## Commits

- Commit after each passing unit of work, in your worktree's branch. One line saying what now works, in plain words.
- End every commit message with the attribution lines your own session gives you (they name the model that did the work).
- Do not merge into `main`. The orchestrator merges.

## Budget and handoff

Stay under about 300k tokens. Keep a short `HANDOFF.md` in your worktree root and update it at each commit: what is done, what is in progress, what is left, decisions and assumptions with reasons, open questions, the exact commands to verify. If you judge you are near 300k tokens, or your context has been compacted once and you are not close to done: finish the current unit, commit, update `HANDOFF.md`, and return with status "handoff". That is a normal outcome. Do not commit `HANDOFF.md`.

## Your report

- Status: done, or handoff.
- The branch name and the worktree path.
- What now works, as a short list.
- Existing tests changed, each with the reason.
- Assumptions you made.
- Spec text that is now wrong or missing (file and heading), so the orchestrator can correct it. Do not edit the spec yourself.
- The check results.
- Anything you saw that someone should look at.
