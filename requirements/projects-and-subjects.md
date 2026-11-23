# Requirements: projects and subjects

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.1 Projects

**FR-001:** A project is a single file on the user's computer, with the app's own file extension (`.adman`). The file holds all of the project's data. It does not hold asset files. It links to them, and they stay where they are on the user's machine unless the user chooses otherwise (FR-007, FR-052).
**Priority:** P0
**Notes:** A project moves to another machine through "Package project" (FR-008), not by copying the project file alone. Keys are never stored in the project file or in its assets folder.
**Changed in 1.1:** R-06, R-07. Before, a project was a folder that held its data file, imported assets and generated files.

**FR-002:** The app has no global history of the user's work. The user creates a project, opens a project file, or picks from a recent-projects list.
**Priority:** P0
**Notes:** Opening a project file from the operating system (for example by double-click) opens it in the app.
**Changed in 1.1:** R-06. "Project folder" became "project file".

**FR-003:** The user can switch from one project to another inside the running app, without quitting and starting it again. From inside a project the user can go to a recent project, open a project file, create a project, and close the current project. Projects are not shown as tabs. The main tabs are the project's open campaigns (FR-211).
**Priority:** P0
**Notes:**
- The stakeholder's words: "we don't expect the user to be switching between projects as often, so while we want to preserve that ability from within one instance of the app, the main tabs should be open campaigns".
- Switching project is the less common action. It can take more steps than switching campaign or variant, but it must stay possible from wherever the user is in a project.
- Not decided: whether one window shows one project at a time, or two projects can be seen side by side (Q-038). This requirement does not say how many projects can be open at once. Before 1.4 it said several could be.
- Not decided: what happens to a running generation when the user switches or closes the project (Q-039).
**Changed in 1.4:** D-028. Before: "Several projects can be open at the same time, as tabs in one window."

**FR-004:** New projects are created in a default location inside the user's own documents area. The user can change the default and can choose a location per project.
**Priority:** P0

**FR-005:** A project holds any number of campaigns and one shared set of subjects.
**Priority:** P0

**FR-006:** The project saves automatically after every change. There is no save button. Undo history is cleared when the project closes.
**Priority:** P0

**FR-007:** Each project has an assets folder. By default it sits beside the project file and is named after it. The app saves generated files there, and imported files the user chose to copy (FR-052). The user can change the assets folder location per project.
**Priority:** P0
**Added in 1.1:** R-07, R-08.

**FR-008:** A "Package project" command gathers everything related to the project into one folder the user chooses: the project file and every asset file the project has a record of. That covers every linked file, and every generated file and copied import in its assets folder, including generated options that no variant uses. The packaged folder opens on another machine with nothing missing. The original project is left as it is.
**Priority:** P0
**Notes:**
- This is how a project is moved to another machine or handed to another person. Keys are not part of a project and are never packaged (FR-001, FR-173).
- A file that sits in the assets folder but that the project has no record of is not part of the project and is not packaged.
- When a linked file is missing (FR-009), the app refuses to package the project unless the user confirms that the missing files are to be skipped. Skipped files are not in the packaged folder, so "nothing missing" does not cover them.
**Added in 1.1:** R-09.
**Changed in 1.2:** D-011. Wording now states that a packaged project includes everything related to the project.
**Changed in 1.3:** D-022, D-027. "Every file in its assets folder" became "every asset file the project has a record of". Unused generated options are included. Files the project has no record of are left out. Packaging with a missing linked file needs the user's confirmation.

**FR-009:** When a linked file cannot be found, the app marks the asset as missing, shows this on every variant that uses it, and lets the user point the app to the file's new location. A variant with a missing file is not exported. It is listed as a failure in the report (FR-150).
**Priority:** P0
**Notes:** A linked file changed outside the app shows its new content in the project. This requirement follows from linking files instead of copying them (FR-001, FR-052). Packaging a project that has a missing file is covered in FR-008.
**Added in 1.1:** R-06.
**Changed in 1.3:** D-027 (notes only, pointer to FR-008).

### 4.2 Subjects

**FR-010:** A subject is the thing an ad is about. It can be a physical product or a service. The UI term is "Subject". The brief's term "product" maps to it.
**Priority:** P0

**FR-011:** Each subject has a unique ID within the project (for example a SKU), a display name, one or more photos of it, and an optional description. The photos define the subject first.
**Priority:** P0
**Notes:** Two different subjects must never share stored assets. The ID, not the display name, identifies the subject. Files attached to a subject can be in either library (FR-054). Every photo of a subject is offered, and chosen at the start, as a reference for AI pictures of it, and any of them can be placed in an ad.
**Changed after 1.4:** R-21. Before, a description was required and photos were "attached reference files".

**FR-012:** Subjects are shared by all campaigns in the project. They are not shared between projects except by import or copy.
**Priority:** P0
