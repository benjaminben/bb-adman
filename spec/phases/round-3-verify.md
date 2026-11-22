# Round 3: what to verify

Assumptions made while building the stakeholder's round 3 notes (2026-11-22), for him to confirm or change. The rulings are D-103 and D-104 in `DECISIONS.md`.

1. **Dropdown arrow.** Every dropdown now draws the app's own arrow with room to its right. Built in `ui/base.css`.
2. **Shipped ComfyUI workflows are proven (D-103).** Six become `proven`: the three MiniMax H3 video workflows, MOSS-Image from a prompt, FLUX with reference pictures, the BiRefNet cut-out. The two MOSS-Image workflows for reference pictures and extend stay `draft`: their graphs are stand-ins no server can run. The BiRefNet cut-out has not had a real run yet (the test server lacked the model file).
3. **Custom workflows are kept per computer, not per project (D-104).** A project or package never carries one. This reads "treat workflows like assets which are external files" as: picked from disk and copied into the app's own folder. The older draft requirements (per project, packaged with the project, marking inside the app, a warning when a person adds one) are not built.
4. **Marks.** A step's title starts with `adman:` followed by one or more of `prompt`, `seed`, `width`, `height`, `ref1` to `ref8`, `first-frame`, `frames`, `output`. The job is worked out from the marks; nobody picks it. No mark for a negative prompt or frames per second in this round.
5. **A person's add asks nothing.** No warning dialog; Settings shows one fixed line that the licence of the models is the person's own matter.
6. **An agent's add always asks**, lists every node type, and says the workflow can use any node on the server, "including nodes that read files on that computer, reach the internet or use paid services". No "don't ask again". An agent can list and run workflows but never read one back.
7. **Paid nodes on the server (accepted risk, please confirm).** A workflow can call a paid service from the ComfyUI server with keys kept there. Once added, an agent may run it under the ComfyUI tick, which the app otherwise treats as free. The ask dialog names this; nothing else limits it.
8. **Limits and defaults.** At most 50 workflows; a file at most 2 MiB and 500 nodes. Defaults a person can change in Settings: pictures about 1 megapixel, video about 0.4 megapixel, 24 frames a second, clips up to 5 seconds. A workflow takes exactly as many reference pictures as it has `ref` marks.
9. **Changing a workflow** means removing it and adding the new export; the app does not watch the picked file. Removing one makes runs that have not started fail; runs already sent go on.
10. **The remembered workflow choice** is per computer and per job kind.
