# Requirements: external agent control (MCP server)

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.18 External Agent Control (MCP Server)

**FR-190:** The app includes an MCP server that lets an external agent control the app.
**Priority:** P0
**Notes:** Main purpose: a user with an AI subscription or enterprise AI in another app can have that agent place copy, with no extra layout API charges. The third-party layout API remains available (FR-061).

**FR-191:** The server is off until the user turns it on in Settings. It accepts connections only from the same computer, and only from a client that presents the app's access token.
**Priority:** P0
**Notes:** The user can view the token in full and copy it in the app, and gives it to their agent app. The token is not covered by the rule that a saved key can never be viewed (FR-173). The user can replace the token with a new one, which stops clients that hold the old one.
**Changed in 1.1:** R-04. The token is new.
**Changed in 1.2:** D-014 (notes only). The user can view and copy the token.

**FR-192:** Through the server an agent can read the open project: campaigns, subjects, variants, layers and rule sets. It can also list the project's assets and fonts by name and ID, without file contents.
**Priority:** P0
**Changed in 1.1:** R-11. The asset and font list is new.

**FR-193:** An agent can request a rendered picture of a variant, so it can judge where copy fits.
**Priority:** P0

**FR-194:** An agent can create and edit layers: place and style text, set copy, and supply translations.
**Priority:** P0

**FR-195:** An agent can create a campaign from a brief and add variants. The agent sends the brief as structured fields. For an agent the app makes no AI extraction call (FR-022) and shows no confirm form (FR-023). The campaign appears in the app at once. Creating a campaign is not an action that undo reverses. An agent can delete a campaign, with the user's permission as for any agent delete (FR-197). An agent can change a variant's format, from image to video or from video to image (FR-120).
**Priority:** P0
**Notes:**
- The agent's request carries the choices a user would make on the confirm form, such as which subject each brief subject maps to (FR-024) and the ratios and languages (FR-026).
- The stakeholder's words on removing a campaign the agent made: "the agent can delete a campaign they create, this isn't the same as Undo". Deleting a campaign is a destructive action and needs the user's permission as in FR-197. This holds for every campaign, whoever created it. There is no exemption for a campaign the agent created itself. The stakeholder's words: "Ok let's just request permission for any campaign delete".
- A format change by an agent follows the same rules as any agent edit (FR-200), and the rule in FR-120 that video settings are kept applies. It is not a destructive action (FR-197) and does not need the user's permission. The stakeholder's words: "Yes agent can change format".
**Changed in 1.1:** R-01.
**Changed in 1.2:** D-010. "Can be undone" was wrong and is replaced by "an agent can delete a campaign it created".
**Changed in 1.3:** D-023, D-025. The delete sentence no longer singles out campaigns the agent created, and the note states that permission is needed for every campaign delete. An agent can change a variant's format.

**FR-196:** An agent can run the checks and read the results. This covers the brand and legal checks (FR-110 to FR-113) and the readiness checks (FR-116), as in FR-114.
**Priority:** P0
**Changed in 1.3:** Wording only (SPEC.md OI-19). Before, the text named only the brand and legal checks.

**FR-197:** An agent can delete campaigns and variants. Every destructive action by an agent needs the user's explicit permission in the app's UI before it happens. The user can set this permission to automatic.
**Priority:** P0
**Notes:** "Destructive" means deleting a campaign or a variant. Deleting or replacing a single layer is an ordinary edit, covered by undo. An agent cannot delete subjects or assets. The rule in FR-073 still applies: a master variant cannot be deleted on its own.

**FR-198:** An agent can never read or change saved keys.
**Priority:** P0

**FR-199:** An agent cannot start image or video generation, export to disk, or publish to cloud storage in this build. These are deferred. The design should allow them to be added later.
**Priority:** P0

**FR-200:** Agent edits follow the same rules as user edits:
- They appear in the app as they happen.
- They can be undone. Creating a campaign is not covered by undo (FR-195).
- They are marked as agent-made in the log.
- Translations from an agent need the user's approval (FR-101).
- Edits to a master mark linked variants out of date and nothing cascades until the user runs a sync review (FR-081).
**Priority:** P0
**Changed in 1.2:** D-010 (pointer to FR-195 added).

**FR-201:** An agent works only on projects that are open in the app.
**Priority:** P0
**Notes:** An agent's reach does not depend on which campaign or variant has a tab open or is on screen (Section 4.19). How many projects can be open at once is not decided (FR-003, Q-038).
**Changed in 1.4:** D-028 (notes only).
