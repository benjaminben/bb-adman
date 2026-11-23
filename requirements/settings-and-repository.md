# Requirements: settings, keys and the repository

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.16 Settings and Keys

**FR-170:** Keys are entered inside the app. The user never edits a settings file.
**Priority:** P0

**FR-171:** The app asks for a key only when an action needs it. The app is usable for manual work with no keys.
**Priority:** P0

**FR-172:** A key is not tested when entered. It is first used when the user takes an action that needs it.
**Priority:** P0

**FR-173:** Keys are stored encrypted in the application data folder, outside any project. A saved AI provider key or cloud storage key can never be viewed. The app shows only its last four characters. The user can replace or delete a key.
**Priority:** P0
**Notes:** Exception: the agent access token (FR-191). It is for use on the local computer and is treated differently from provider and storage keys. The user can view it in full and copy it in the app.
**Changed in 1.1:** R-10. Before, a saved key could be viewed after the computer's user password, admin password or biometric check.
**Changed in 1.2:** D-014. The agent access token is an exception to "can never be viewed".

### 4.17 Repository

**FR-180:** The repository has a README covering how to run the app, example input and output, key design decisions, and assumptions or limitations.
**Priority:** P0
**Notes:** The example set is one brief with two subjects, exported in three ratios and two languages.

**FR-181:** No secret is ever committed. Generated files are not committed, except the small example set the README needs.
**Priority:** P0
