# Data model: campaigns, variants and layers

The tables a campaign is made of: `campaign`, `campaign_subject`, `rule_set`, `direction`, `variant`, `variant_subject`, `layer` and `background_clip`, with their stored JSON types and campaign sizes. Read with `spec/data-model.md` (where data lives, IDs, project-level tables, JSON column rules) and `spec/data-rules.md` (follow rules, sync, fan-out, format change).

## Campaign tables

Built: every table below exists in the project file, from migration `0000` (plus `variant.agent_changed_at` from `0001`). Drizzle schema: `src/main/db/schema/project.ts` (campaign, campaign_subject, rule_set, direction) and `src/main/db/schema/variant.ts` (variant, variant_subject, layer, background_clip). Timestamps, booleans and JSON columns follow the rules in `spec/data-model.md`, "Tables".

### campaign

[REQ: FR-030–FR-034, FR-043]

```sql
CREATE TABLE campaign (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  region           TEXT NOT NULL,
  audience         TEXT NOT NULL,
  message          TEXT NOT NULL,
  offer            TEXT,
  call_to_action   TEXT,
  tone             TEXT,
  primary_language TEXT NOT NULL,       -- BCP-47
  languages        TEXT NOT NULL,       -- JSON: string[] of BCP-47 tags, includes primary
  sizes            TEXT NOT NULL,       -- JSON: CampaignSize[]
  template_id      TEXT NOT NULL,
  brief            TEXT NOT NULL,       -- JSON: the confirmed Brief
  created_by       TEXT NOT NULL,       -- CHECK campaign_created_by: 'user' | 'agent'
  created_at       TEXT NOT NULL
);

CREATE TABLE campaign_subject (
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subject(id),
  PRIMARY KEY (campaign_id, subject_id)
);
```

- `campaign.update` never rewrites the stored `brief` column. It is the record of what the user confirmed.
- A campaign always has a `rule_set` row. One with none is a damaged file: reading it throws a plain `Error` with a fixed sentence, which is the standard `INTERNAL` reply.

```ts
type CampaignSize = { label: string; width: number; height: number }
// label: "1x1", "9x16", "16x9", "4x5", or "{width}x{height}" for other pixel sizes
```

`CampaignSize` is in `src/shared/schemas/commands/campaign.ts`. The label must match `^[1-9]\d*x[1-9]\d*$`. Size labels within one campaign must differ.

**Ready-made sizes** [REQ: FR-026, FR-032, FR-247]. `READY_MADE_SIZES` in `src/shared/config/defaults.ts` is the one list:

| Label | Pixels | Selected by default |
|-------|--------|---------------------|
| `1x1` | 1080 × 1080 | Yes |
| `9x16` | 1080 × 1920 | Yes |
| `16x9` | 1920 × 1080 | Yes |
| `4x5` | 1080 × 1350 | No |

- **One pixel size, one label.** A size whose pixels equal a ready-made size takes that size's label, however it was typed. `4:5`, `4x5` and `1080x1350` all give `{ label: '4x5', width: 1080, height: 1350 }`, and `1080x1080` gives `1x1`. Any other size keeps `{width}x{height}`. Reason: the label names the export folder and is part of the `variant_grid` index, so two labels for the same pixels would allow two variants that are the same ad.
- A brief that names no sizes gets the three default ones.

**Reading a typed size** (`parseSize` in `src/shared/brief/size.ts`; it reads the list and holds no size of its own):

- Spaces at both ends and around the separator are ignored. A pixel size uses `x`, `X` or `×`. A ready-made label typed as is means that size. Leading zeros are dropped. Anything else gives null.
- A custom ratio `a:b` becomes a pixel size whose shorter side is 1080; the longer side is rounded to whole pixels [REQ: FR-032].
- **A ratio may have decimals.** Each part of `a:b` is digits, or digits, a dot and digits (`1.91:1`, `4:5.0`). Each part must be above zero. `1.91:1` gives `{ label: '2063x1080', width: 2063, height: 1080 }`. Refused: a comma as the decimal mark, a part with no digit on one side of the dot (`.5:1`, `1.:1`), an exponent, a sign. A pixel size is whole numbers only (`1080.5x1350` is refused).
- **Two small numbers with `x` are a ratio.** In `AxB`, when both numbers are below 100, the text is read as the ratio `A:B`. So `2x3` gives `1080x1620`. When either number is 100 or more it is a pixel size (`50x1080` is 50 by 1,080 pixels). Decimals are not read in this form.
- Both result sides must be whole numbers within the safe integer range and within the size limits below, or the answer is null.

**Smallest and largest side.** Each side of a campaign size is from 50 to 8,192 pixels, both included. `src/shared/config/size-limits.ts` owns `MIN_SIZE_SIDE = 50` and `MAX_SIZE_SIDE = 8192`. Two places read them and neither holds the numbers:

- `parseSize` gives null when either result side is outside the range, for every form.
- The `CampaignSize` schema refuses a `width` or `height` outside the range. This is the real gate: `campaign.create` and the MCP tool take sizes that never went through `parseSize`.
- Sizes: `8192x8192`, `300x50`, `7.5:1` (8,100 by 1,080), `50x1080`. Not sizes: `8193x1080`, `1080x8193`, `49x1080`, `100x49`, `1000x10`, `1:8` (1,080 by 8,640).
- Why 8,192: it is the limit pictures already have (`spec/providers.md`), and no screen or export draws more. Why 50: common banner sizes have a 50 pixel side (`300x50`, `320x50`), and at 50 every box and font size of the default layout is still above zero. Below 15 the call-to-action font size rounds to 0 and the layer fails its schema. Test in `tests/unit/shared/templates/`: `buildMasterLayers` with all five slots filled at `50x50`, `300x50` and `8192x8192` gives layers that each pass `LayerRow`, with every box width, box height and font size above zero.
- OI-33: the stakeholder has not confirmed the two numbers; they are the architect's default.

### rule_set

[REQ: FR-033, FR-034, R-03]

```sql
CREATE TABLE rule_set (
  campaign_id        TEXT PRIMARY KEY REFERENCES campaign(id) ON DELETE CASCADE,
  required_asset_ids TEXT NOT NULL DEFAULT '[]',  -- JSON: asset IDs
  palette            TEXT NOT NULL DEFAULT '[]',  -- JSON: "#RRGGBB"[]
  required_words     TEXT NOT NULL DEFAULT '{}',  -- JSON: { [language]: string[] }
  prohibited_words   TEXT NOT NULL DEFAULT '{}'   -- JSON: { [language]: string[] }
);
```

Copying a rule set copies the four JSON values from the source campaign [REQ: FR-034].

### direction

[REQ: FR-072, FR-073, FR-074]

```sql
CREATE TABLE direction (
  id                TEXT PRIMARY KEY,
  campaign_id       TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  master_variant_id TEXT NOT NULL,
  sort              INTEGER NOT NULL
);
```

`master_variant_id` is set when the direction is created and no command changes it [REQ: FR-073].

### variant

[REQ: FR-070, FR-071, FR-120]

```sql
CREATE TABLE variant (
  id            TEXT PRIMARY KEY,
  direction_id  TEXT NOT NULL REFERENCES direction(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  size_label    TEXT NOT NULL,
  language      TEXT NOT NULL,
  format        TEXT NOT NULL,             -- CHECK variant_format: 'image' | 'video'
  duration_ms   INTEGER NOT NULL,          -- used when format = 'video' or any sibling is video
  duration_overridden INTEGER NOT NULL DEFAULT 0,
  rev           INTEGER NOT NULL DEFAULT 0, -- +1 on every change to the variant, its layers or clips
  created_by    TEXT NOT NULL,             -- CHECK variant_created_by: 'user' | 'agent'
  created_at    TEXT NOT NULL,
  agent_changed_at TEXT                    -- migration 0001. Last time an agent changed the variant; null = never
);

CREATE TABLE variant_subject (
  variant_id TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subject(id),
  PRIMARY KEY (variant_id, subject_id)
);

CREATE UNIQUE INDEX variant_grid ON variant(direction_id, size_label, language, format);
```

- The title defaults to the variant's subject IDs joined with `+` [REQ: FR-142].
- The master is the variant named by `direction.master_variant_id`.
- Default duration is 6000 ms. Default export frame rate is 30 (`DEFAULT_FPS`) [REQ: A-07]. Frame rate is an export choice and is not stored on a variant.

**`agent_changed_at`** (wire `agentChangedAt`) [REQ: FR-239]. Built: the column and its writer. No command bumps `variant.rev` yet, so the column is null for every variant.

- It has one writer. `bumpVariantRev(ctx, variantId, now)` in `src/main/commands/variant-rev.ts` is the one way a command bumps `rev`: it adds one to `rev` inside the command's transaction and, only when the actor is the agent, sets `agent_changed_at` to `now`. A command by the user never changes it, and undoing an agent's edit does not clear it. Unit test: `tests/unit/main/commands/variant-rev.test.ts`, both actors.
- Creating a variant does not set it; `created_by` records that. A variant made by an agent has `agentChangedAt: null`.
- The first command that bumps `rev` (Phase 3's layer commands) adds the test through that command, sent once as the user and once as the agent. Phase 10 adds one test through an MCP tool and no code. The export report reads it (Phase 8).

### layer

[REQ: FR-078–FR-083, FR-090–FR-094, FR-098, FR-101, FR-127–FR-129]

```sql
CREATE TABLE layer (
  id            TEXT PRIMARY KEY,
  variant_id    TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,       -- shared with the matching layer in the master
  type          TEXT NOT NULL,       -- CHECK layer_type: 'background' | 'image' | 'text'
  slot          TEXT,                -- template slot ID, if the layer fills one
  name          TEXT NOT NULL,
  z             INTEGER NOT NULL,
  visible       INTEGER NOT NULL DEFAULT 1,
  locked        INTEGER NOT NULL DEFAULT 0,
  linked        INTEGER NOT NULL DEFAULT 0,
  overrides     TEXT NOT NULL DEFAULT '[]',  -- JSON: property paths, e.g. "style.fontAssetId"
  copy          TEXT,                -- text layers: the text
  style         TEXT NOT NULL,       -- JSON: TextStyle | ImageStyle
  geometry      TEXT NOT NULL,       -- JSON: Geometry
  source        TEXT,                -- JSON: { assetId } for image and background layers
  timing        TEXT NOT NULL,       -- JSON: Timing
  animation     TEXT NOT NULL,       -- JSON: Animation
  revs          TEXT NOT NULL,       -- JSON: Revs { copy, style, geometry, source, timing, animation }
  synced_revs   TEXT NOT NULL,       -- JSON: Revs, the master counters this layer last synced to
  translation_status TEXT,           -- CHECK layer_translation_status: 'missing' | 'proposed' | 'approved'
  translation_source TEXT,           -- CHECK layer_translation_source: 'ai' | 'agent' | 'user' | 'brief'
  overflow      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX layer_variant ON layer(variant_id, z);
CREATE UNIQUE INDEX layer_variant_key ON layer(variant_id, key);
```

The JSON types, from `src/shared/schemas/layer.ts`:

```ts
type Geometry = {
  x: number; y: number; width: number; height: number   // pixels, top-left origin
  rotation: number                                       // degrees
  crop: { x: number; y: number; width: number; height: number } | null  // in source pixels
}
type TextStyle = {
  fontAssetId: string | null    // null = bundled default font
  fontSize: number              // above 0
  fontWeight: number
  color: string                 // "#RRGGBB"
  align: 'left' | 'center' | 'right'
  lineHeight: number            // multiple of font size
  letterSpacing: number         // tracking, as a multiple of font size (em), -0.2 to 1. 0 = the font's own spacing [REQ: FR-249]
  // Look fields (LK-1). Optional; absent = the default in brackets.
  verticalAlign?: 'top' | 'middle' | 'bottom'   // [top]
  allCaps?: boolean                             // [false]
  boxColor?: string | null                      // "#RRGGBB" fill behind the text, null = none [null]
  boxOutlineColor?: string | null               // "#RRGGBB", null = no outline [null]
  boxOutlineWidth?: number                      // px, 0 to 100; 0 = no outline [0]
  boxRadius?: number                            // px, 0 to 2000 [0]
  boxPadding?: number                           // px on all four sides, 0 to 2000 [0]
}
type ImageStyle = {
  opacity: number                                        // 0 to 1
  fillColor?: string | null     // LK-1. Background layers only: "#RRGGBB" under the picture; null = none [null]
  shade?: Shade | null          // LK-1. [null]
}
type Shade = {                  // LK-1. Replaced whole, never merged (a strict object)
  color: string                 // "#RRGGBB"
  from: 'bottom' | 'top' | 'left' | 'right' | 'all'
  strength: number              // 0 to 1: how opaque the shade is where it is strongest
  reach: number                 // 0.05 to 1: share of the box it fades across; not used for 'all'
}
type Timing = { startMs: number; endMs: number | null }  // null = end of the variant
type AnimationBlock = {
  preset: 'none' | 'fade' | 'fade-up' | 'slide' | 'stagger-words'
  startMs: number               // relative to the variant start
  durationMs: number
}
type Animation = { entrance: AnimationBlock; exit: AnimationBlock }
type Revs = { copy: number; style: number; geometry: number; source: number; timing: number; animation: number }  // whole numbers, 0 or more
```

**Rules:**

- A background layer's geometry and crop are its stored transform. The source file is never changed, so cropping never discards pixels [REQ: FR-077].
- Each variant has exactly one background layer with `z = 0`. It cannot be deleted or reordered.
- The background layer exists from the start, before any picture is chosen. Until then its `source` is null and it draws nothing. Its `slot` is `background` whenever the template has that slot. So a slot is not "filled" just because a layer names it: an image or background layer fills its slot only when `source` is not null (`spec/brief-and-templates.md`, "Default layout").
- A linked layer matches the master layer with the same `key`. Links are one level deep because only a direction's master can be the target [REQ: FR-078].
- Every variant stores its own full values. A sync is the only thing that writes master values into a linked layer [REQ: FR-081]. Follow rules and sync: `spec/data-rules.md`.
- `translation_status` is null on layers in the campaign's primary language and on non-text layers.
- `overflow` is written by the Scene when it measures a text layer (`spec/data-rules.md`, "Text overflow") [REQ: FR-098].
- Only text layers may have a preset other than `none` [REQ: FR-128].
- **Look fields** (Built, LK-1) [D-094]. A background colour, a box behind text, vertical alignment, all capitals and a shade over a picture (`spec/phases/look-pack.md`). They live in `style`, a JSON column, so no migration: a row stored without them reads with each absent, and absent means the default above, which draws exactly as before (A-71). The schemas hold no `.default()` (Zod 4 would fill defaults inside a patch); `textLookOf` and `pictureLookOf` in `src/shared/config/look.ts` are the one owner of the defaults, used by the Scene, the panel and the patch checks. The bounds are `LOOK_LIMITS` in `layer.ts`: `{ boxOutlineWidth, boxRadius, boxPadding, shadeStrength, shadeReach }`, each `{ min, max }`, the ranges above. `look.ts` also holds `TEXT_LOOK_DEFAULTS`, `PICTURE_LOOK_DEFAULTS` and `NEW_SHADE = { color: '#000000', from: 'bottom', strength: 0.7, reach: 0.6 }`, the shade the panel sends when a side is chosen and the default layout's background shade. `fillColor` is for the background layer only (A-73): null or absent draws nothing, so the black root shows, as today (A-72). The names differ between the two styles, so the patch union cannot mistake one for the other. They are part of `style`: a change bumps `revs.style` and re-measures overflow. New layers store every look field (`spec/starter-layouts.md`). Drawing: `spec/scene.md`, "Text boxes" and "Background colour and shade".
- **`letterSpacing`** [REQ: FR-249]. The starter template sets 0. The Scene draws it with the CSS `letter-spacing` property in `em` (built, `src/shared/scene/text-style.ts`). It is part of `style`, so it follows the master with the rest of style, and a change bumps `revs.style`. A change re-measures overflow like any style change [REQ: FR-098].

### background_clip

[REQ: FR-121, FR-122]. Table built; clip commands not built (Phase 7).

```sql
CREATE TABLE background_clip (
  id          TEXT PRIMARY KEY,
  variant_id  TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES asset(id),
  start_ms    INTEGER NOT NULL,   -- position on the track
  in_ms       INTEGER NOT NULL,   -- trim from the start of the source
  out_ms      INTEGER NOT NULL,   -- trim point at the end of the source; for a still, in_ms + shown length
  placement   TEXT                -- JSON: Geometry, or null to use the background layer's geometry
);
CREATE INDEX clip_variant ON background_clip(variant_id, start_ms);
```

- Clips on one track may not overlap. The command refuses a move or trim that would overlap [REQ: 1.4 out of scope].
- Time with no clip shows black [REQ: FR-122].
- Each video variant owns its clips. Clips are never linked or synced [REQ: R-05].
- An image variant ignores this table and draws its background layer's `source`.

