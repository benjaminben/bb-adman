# Requirements: constraints

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

## 9. Constraints

### 9.1 Technical Constraints
Fixed by the brief or the stakeholder:
- Electron desktop app with a React UI layer.
- SQLite database.
- FFmpeg included in the app for exporting video.
- MCP as the protocol for external agent control.
- GSAP is not used. *(Added in 1.1: R-14.)*

Stakeholder preferences for the architect (not fixed):
- Text rendered with HTML canvas or SVG.
- FFmpeg for burning text into video on export.
- Animated text: the earlier preference for GSAP timelines rendered frame by frame in a headless browser is withdrawn (R-14). How presets are computed is for the spec. FR-129 and FR-131 still apply.
- One storage interface (exists, read, write) with a local version and a cloud version.
- Predictable storage paths.

### 9.2 Organizational Constraints
- The repository is public.
- The user supplies their own keys for AI providers and cloud storage, and their own agent app for MCP.
- There is no enterprise Adobe account to test Firefly with.

### 9.3 Regulatory & Legal Constraints
- **Licence:** The code is public to read, but others must not be legally able to use it in their own commercial work. The brief calls the app "OSS"; this intent is narrower than open source as usually defined. The licence is PolyForm Noncommercial 1.0.0, confirmed by the stakeholder (R-19, closes OI-02).
- The licence terms of the included video tool and other bundled parts must be compatible with the chosen licence.
- Font licences may limit which fonts can be published to cloud storage (FR-162).

### 9.4 Timeline & Budget Constraints
None given. The stakeholder asked for this to be treated as a normal app build.
