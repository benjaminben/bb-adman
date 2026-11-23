# Requirements: video and animation

Part of the requirements; `REQUIREMENTS.md` is the index. Section numbers are the same as before the split.

### 4.12 Video and Animation

**FR-120:** Format (image or video) and duration are properties of a variant. Different video variants can have different durations. There is no maximum duration. The user can change a variant's format after it is created, in either direction: from image to video and from video to image. A format change loses nothing that applied to the variant as a video. When a video variant is changed to an image and later changed back to a video, every setting it had as a video is as it was before.
**Priority:** P0
**Notes:**
- The stakeholder's words on image to video: "an image variant can be 'upgraded' to a video variant". On the way back: "Sure video can be moved back to image".
- The stakeholder's words on what is kept: "any settings which applied to video format should be preserved if switched to image and then back to video". This covers everything that belongs to the variant as a video, for example its duration and its background clips (FR-121). Timing and animation are already kept on the layers of image variants (FR-079). How the settings are kept is for the spec.
- An external agent can also change a variant's format (FR-195).
**Changed in 1.2:** D-012. The change from image to video is now stated.
**Changed in 1.3:** D-020, D-026. Format can be changed both ways. Video settings survive a change to image and back.

**FR-121:** A video variant has a background track that holds one or more clips in a row. A clip is a still image, a generated video or a video file the user provides.
**Priority:** P0

**FR-122:** Each background clip can be moved, reordered and trimmed at either end. Time not covered by a clip shows black.
**Priority:** P0

**FR-123:** The app can generate a video from a variant's finished background image. Generation is for one variant at a time and is started by the user.
**Priority:** P0

**FR-124:** Video generation runs as a background job with a visible status. The user can keep working. If it fails, the variant keeps what it had and offers retry.
**Priority:** P0
**Notes:** The rules in Section 4.19 for a generation that runs while the user works elsewhere (FR-215 to FR-218) apply to video generation.
**Changed in 1.4:** D-028 (notes only).

**FR-125:** The app does not edit the content of generated video. A user who wants to edit a clip does so in another tool and imports the result.
**Priority:** P0

**FR-126:** The same text layers shown over the video in preview are burned in on export.
**Priority:** P0

**FR-127:** Video variants have a timeline with one track per layer. Each layer has a start and end time within the variant's duration. Layers other than the background have one item per track.
**Priority:** P0

**FR-128:** Text layers can have an entrance animation and an exit animation, each with a preset, a start time and a duration, shown as blocks on the track that can be moved and resized. Presets: fade, fade up, slide, stagger by word, none.
**Priority:** P0
**Notes:** Only text layers animate in this build.

**FR-129:** Animation is stored as data (preset, start, duration), not code, so the same preset works on a longer translated headline.
**Priority:** P0

**FR-130:** The timeline has a playhead with play, pause and scrub. The preview matches the export.
**Priority:** P0

**FR-131:** Exported animation is identical regardless of the speed of the machine.
**Priority:** P0

**FR-132:** Video exports at up to 60 frames per second. All video is silent.
**Priority:** P0
