# Requirements: navigation, parallel work and the app window

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.19 Navigation and Parallel Work

This section is new in 1.4. It states what the user must be able to do. The clickable prototype (round 2, `design/prototype/`) shows one way of doing it, and the stakeholder accepted its navigation layout ("Navigation layout feels MUCH better"). Fonts, colours and other visual choices are not requirements here.

**FR-210:** The app is built around parallel work. The user can have several campaigns and several variants in hand at the same time, can move between them quickly, and finds each one as they left it. Waiting for a generation never stops the user from working on something else.
**Priority:** P0
**Notes:**
- The stakeholder's words: "The user will want to be working on multiple campaigns and variants at the same time, especially while waiting for generation to complete, so the design principle should revolve around letting work happen in parallel. Things should be easy to navigate around."
- This is the principle. FR-211 to FR-218 and FR-152 are the testable parts of it. Where a later design question is not covered by them, this principle decides it.
**Added in 1.4:** D-028.

**FR-211:** Open campaigns are the main tabs of the app. The user can have several campaigns of the project open at once, each in its own tab, and can go from one to another in one action. The user can open another campaign or start a new one from the tabs, and can close a tab.
**Priority:** P0
**Notes:**
- The stakeholder's words: "the main tabs should be open campaigns".
- Closing a campaign tab only removes the tab. The campaign and its variants are not changed or deleted.
- Things that belong to the whole project (the campaign list, subjects, both libraries, "Package project") stay reachable while campaign tabs are open (FR-003).
**Added in 1.4:** D-028. Prototype gap G-11.

**FR-212:** Inside a campaign there are variant tabs. The campaign's overview (the grids of all its variants, FR-074) is always there, and each variant the user opens gets its own tab beside it. Several variants can be open at once, and the user can go from one to another, or back to the overview, in one action. The user can close a variant tab.
**Priority:** P0
**Notes:**
- The stakeholder's words: "there should be variant tabs within the campaign view".
- The user opens a variant from the overview. Whether a plain click on a variant's tile goes to the variant or opens it in a tab behind the overview is not decided (Q-041). The prototype goes to the variant.
- Closing a variant tab only removes the tab. The variant is not changed or deleted, and its undo list is kept as FR-095 says.
**Added in 1.4:** D-028. Prototype gap G-12.

**FR-213:** Every tab keeps its place while the project stays open. When the user comes back to a campaign, it has the same variant tabs open as when they left it, and shows the same one. When the user comes back to a variant, it is as they left it, including which layer was selected.
**Priority:** P0
**Notes:**
- The selected layer is the minimum. What else a variant tab keeps (for example zoom or the playhead position) is for the design and the spec, guided by FR-210.
- Not decided: whether open campaign tabs and variant tabs are remembered the next time the project is opened (Q-040). This requirement covers only the time the project stays open.
**Added in 1.4:** D-028. Prototype gap G-12.

**FR-214:** From the overview the user can open a variant in a tab without leaving the overview, so that several variants can be opened one after another.
**Priority:** P1
**Notes:**
- The prototype has this as a separate control on the tile. Which of the two ways of opening a plain click does is not decided (Q-041). Both ways are available whichever is chosen.
- P1 is the analyst's proposal. The stakeholder accepted the layout that includes this control but has not spoken about it. To be confirmed with Q-041.
**Added in 1.4:** D-028. Prototype gap G-13.

**FR-215:** A generation the user has started keeps running when the user closes its dialog or panel, goes to another variant or campaign, closes the tab of its variant or campaign, or opens Settings. While it runs the user can do any other work in the project, including starting another generation for a different variant.
**Priority:** P0
**Notes:**
- This applies to image generation (FR-060 to FR-065) and to video generation (FR-123, FR-124). FR-124 already said it for video.
- Other AI work that makes the user wait (generate fill, layout proposals, copy options, translations) must never stop the user from working elsewhere in the project (FR-210, 8.1). Whether each of them also survives the closing of its own dialog is for the spec.
- How many generations run at the same moment, and whether later ones wait in a queue, is for the spec. The user must be able to start them without waiting for an earlier one.
- Not decided: what happens to a running generation when the user switches to another project or closes the project (Q-039). This requirement covers work inside the open project.
- Two parts of this are the analyst's reading of the principle, not the stakeholder's words: that closing a tab does not stop a generation, and that a second generation can be started while one runs (Section 10.1, A-08).
**Added in 1.4:** D-028. Prototype gap G-15.

**FR-216:** The result of a finished generation is kept until the user has dealt with it. The user can reopen it later and gets the same options the run produced, to pick one or run again (FR-063). Reopening never runs the generation again and never uses another generation.
**Priority:** P0
**Notes:**
- The user can get to the result from the activity panel (FR-152) and from the variant and layer it belongs to.
- Options the user did not pick stay in the project's record of assets, as FR-008 already assumes ("generated options that no variant uses").
- Whether a result that was never looked at is still there after the project is closed and opened again follows the answer to Q-039.
**Added in 1.4:** D-028. Prototype gap G-15.

**FR-217:** For every running or finished generation the user can tell which campaign and which variant it belongs to, and which layer when it is for one layer. From a running or finished generation the user can go to that place in one action.
**Priority:** P0
**Notes:** This holds wherever a generation is shown: in the activity panel (FR-152) and in any message the app shows when a generation finishes.
**Added in 1.4:** D-028. Prototype gap G-14.

**FR-218:** The user can tell a generation that is still running from one that has finished, and can tell a finished result they have not looked at yet from one they have. Without opening the activity panel, and from wherever they are in the project, the user can see that a campaign or a variant has a generation running or a finished result not yet looked at. The "not yet looked at" mark goes away when the user looks at the result.
**Priority:** P0
**Notes:**
- In the accepted layout the marks sit on the campaign tab and the variant tab the generation belongs to, and in the activity panel.
- How the user is told at the moment a generation finishes (the prototype shows a short message with a "Show result" button) is for the design. The lasting mark is the requirement.
- What counts as "looked at" is for the spec. The intent: the user has seen the result itself, not just the list entry.
- A failed generation is shown as in FR-069 and listed with retry (FR-152).
- Not decided: whether tabs also signal other states, such as "out of date" or a check warning (Q-042). Only running and finished-not-looked-at are required.
**Added in 1.4:** D-028. Prototype gap G-14.

### 4.20 App Window

**FR-220:** When the app starts, its window opens maximized: it fills the usable area of the screen. It does not open in full-screen mode.
**Priority:** P0
**Notes:**
- The stakeholder's words: "the app should default to open with the window maximized (not literally fullscreen)".
- The user can still make the window smaller, or put it in full-screen mode themselves, after it opens.
- Not decided: whether the window opens maximized on every launch, or only the first time and after that at the size the user last left it (Q-036, SPEC.md OI-26). Until that is answered the architect's default applies: maximized on every launch, with nothing remembered.
**Added in 1.4:** D-031.
