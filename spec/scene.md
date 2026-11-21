# Scene, render window and thumbnails

How one variant is drawn: the Scene component, fonts, letter spacing, transparent pictures and the text overflow measurement; the hidden render window and the render service that draw a variant without showing it; and the thumbnails made from it. Read with `spec/data-model-campaign.md` (the layer values the Scene draws), `spec/editor.md` (the editor that shows the Scene), `spec/editor-commands.md` (the commands, queries and events named here) and `spec/security.md` (the render window rules). The reference-picture rule is in `spec/testing.md`.

Everything in this file is Not built (Phase 3) unless marked. Phase 7 adds time and presets; Phase 8 uses the same Scene for export.

## The Scene component

Not built (Phase 3). [REQ: FR-090, FR-093, FR-094, FR-098, FR-130, FR-245, FR-249]

One React component draws one variant at one time. The editor, the render window (thumbnails, `variant.render`, later export and the MCP `render_variant` tool) all draw with it, so what the user sees is what is exported [REQ: FR-130].

### Files

All in `src/shared/scene/`. Shared code: no import from `main`, `renderer`, `preload` or Electron. React is allowed.

| File | Holds |
|------|-------|
| `types.ts` | `SceneProps`, `SceneVariant`, `SceneAsset`, `SceneInput` (below). Built. |
| `scene.tsx` | `Scene`, the root: draws the layers in `z` order |
| `picture-layer.tsx`, `text-layer.tsx` | One layer each. Not re-exported; only `scene.tsx` imports them. |
| `background-placement.ts` | `placePicture`, the one owner of where a picture goes inside its box. The name is kept from the data model: it places the pictures of image layers too. Phase 8's FFmpeg filter builder imports it. |
| `text-style.ts` | `textCss(style, box)`: the exact CSS of a text layer (below) |
| `font-faces.ts` | `useSceneFonts(fonts)`, `DEFAULT_FONT_FAMILY`, `fontFamilyOf(fontAssetId)` |
| `measure-overflow.ts` | `measureOverflow(element)`: the one overflow test |
| `fonts/InterVariable.woff2`, `fonts/OFL.txt` | The bundled default font and its licence |

The Scene has no CSS file. Every value it draws comes from the layer data, so it uses inline styles only. App tokens (`src/renderer/ui/tokens.css`) never reach it: they style the app, not the ad.

### Props

```ts
type SceneVariant = {
  width: number; height: number          // pixels
  language: string                       // BCP-47; becomes the root's lang attribute
  format: 'image' | 'video'
  durationMs: number
}
type SceneAsset = {
  url: string                            // adman-asset:// address, built by the caller
  kind: 'image' | 'font'
  missing: boolean
  width: number | null; height: number | null   // from the asset row; null for WebP and fonts
  version: number                        // goes up when the file changed on disk
}
type SceneProps = {
  variant: SceneVariant
  layers: LayerRow[]                     // any order; drawn by z
  assets: Readonly<Record<string, SceneAsset>>  // every asset a layer names as source or font
  timeMs: number                         // 0 for an image variant; used from Phase 7
  mode: 'full' | 'overlay-only'
  onSettled?: (result: { overflow: Record<string, boolean> }) => void
}
```

- The Scene builds no address. The caller fills `url` with `assetUrl(projectId, assetId)` (`src/renderer/ui/asset-url.ts`, the one owner of the address form). The render page does the same with the IDs main sends it.
- `version` is used as part of the React `key` of each picture and font face, so a file changed on disk is loaded again (the address stays the same; the protocol answers `no-store`).
- `clips` join the props in Phase 7. Phase 3 draws an image variant only. A video variant is drawn as its image (its background layer's `source`), as `spec/data-model-campaign.md` says for an image variant; Phase 7 replaces that.
- `mode: 'overlay-only'` leaves out the background layer and the black root, so the root is transparent. Phase 8 uses it to lay text over a video. Phase 3 builds it and tests it once.

### The root and drawing order

- The root is a `div` of exactly `width` × `height` CSS pixels, `position: relative`, `overflow: hidden`, `lang` set to the variant's language, background `#000000` in `full` mode and transparent in `overlay-only` mode. Where no layer draws, the ad is black, as fan-out's "empty area shows black".
- Layers are drawn in `z` order, lowest first, each `position: absolute`. Two layers with the same `z` (a damaged file) are drawn by ID order.
- The Scene draws in variant pixels. A caller that wants another size scales the root with a CSS `transform: scale(s)` from its top-left corner (the editor's zoom, the render page's output size). Layout and measurement stay in variant pixels.
- A layer with `visible: false` is drawn with `visibility: hidden`: it takes its place, draws nothing, and its text can still be measured.

### Boxes

Every layer is a box from its `geometry`: `left: x px; top: y px; width: width px; height: height px`, `transform: rotate({rotation}deg)`, `transform-origin: 50% 50%`. Rotation turns the box about its centre. `x` and `y` may be outside the canvas; the root cuts off what lies outside.

### Pictures (background and image layers)

- The box is `overflow: hidden`. It holds one `<img>` with `alt=""`, `draggable={false}` and the style `position: absolute` at the place `placePicture` gives. The box's `opacity` is `style.opacity`.
- **Nothing is drawn** when `source` is null (an empty picture layer), when the asset is not in `assets`, is `missing`, is not of kind `image`, or fails to load. The editor draws its own placeholder for an empty picture layer (`spec/editor.md`); the Scene never does, so thumbnails and exports show nothing there.
- **Transparency is kept** [REQ: FR-245]. The box and the `<img>` have no background colour, so a PNG or WebP with a transparent background shows the layers beneath it, in the editor, in thumbnails and in `variant.render`. Phase 8 adds the same test for the exported file.
- The picture's own size is the loaded `<img>`'s `naturalWidth` and `naturalHeight`. Until it is known the `<img>` is drawn with `visibility: hidden`. The row's `width` and `height` are not used for drawing (WebP rows have none).

**`placePicture(source, crop, box, fit)`** in `background-placement.ts`, pure. `source` and `box` are `{ width, height }`; `crop` is `Geometry['crop']`; `fit` is `'cover' | 'contain'`. It returns `{ x, y, width, height }`: where the whole source picture goes, in box pixels. No rounding.

1. The region is `crop`, or the whole picture when `crop` is null. A region that reaches outside the picture is cut to it; a region left with no area counts as null.
2. With a crop, the region **covers** the box: scale `s = max(box.width / region.width, box.height / region.height)`.
3. With no crop, a background layer's picture **covers** its box and an image layer's picture is **contained** in it: `s = min(...)`. A logo or a product cut-out is never cut off; a photo background fills the canvas.
4. The region is centred in the box: `x = (box.width − region.width × s) / 2 − region.x × s`, the same for `y`; `width = source.width × s`, `height = source.height × s`.
5. A picture is never stretched: one scale for both sides.

The editor's crop mode keeps a crop at the box's shape (`spec/editor.md`), so step 2 then shows the crop exactly. Fan-out's `scale` and `crop` choices (Phase 5) are written as a background geometry and crop that these rules draw.

### Text layers

The box holds the copy as text content, never as HTML. `textCss(style, box)` gives exactly these properties and no others, so the editor and the render window lay text out alike:

| Property | Value |
|----------|-------|
| `font-family` | `"adman-font-{fontAssetId}", "adman-default"`, or `"adman-default"` when `fontAssetId` is null |
| `font-size` | `{fontSize}px` |
| `font-weight` | `{fontWeight}` |
| `font-style`, `font-synthesis` | `normal`, `none` |
| `color` | `{color}` |
| `text-align` | `{align}` |
| `line-height` | `{lineHeight}` (a plain number, a multiple of the font size) |
| `letter-spacing` | `{letterSpacing}em` [REQ: FR-249] |
| `white-space`, `overflow-wrap`, `word-break`, `hyphens` | `pre-wrap`, `normal`, `normal`, `manual` |
| `font-kerning`, `overflow`, `padding`, `margin`, `box-sizing` | `normal`, `visible`, `0`, `0`, `border-box` |

- Text starts at the top of its box. There is no vertical alignment.
- The user's line breaks are kept (`pre-wrap`). Words wrap at the box's width. A word longer than the box is not broken; it overflows and is flagged.
- **Letter spacing** is CSS `letter-spacing` in `em`, from −0.2 to 1 (the schema's range). It changes the text's width, so it is counted in the overflow test like any other style [REQ: FR-249].
- **Text that does not fit is drawn as it is**, past its box. It is never cut off and never made smaller [REQ: FR-098]. The editor marks it; the export warns (R-18).
- **CJK and other scripts.** The bundled font has no CJK letters. The browser then takes them from a system font, and the root's `lang` makes it choose the right letter shapes for Japanese, Chinese or Korean. A user who needs a fixed CJK font uploads one [REQ: FR-056].

### Fonts

[REQ: FR-056, FR-093]

- **Family names.** A font asset is registered as the family `adman-font-{assetId}`. The bundled font is `adman-default` (`DEFAULT_FONT_FAMILY`). These names have one owner, `font-faces.ts`.
- **Registering.** `useSceneFonts` adds one `FontFace` per font asset the layers name, through the Font Loading API: `new FontFace('adman-font-{id}', 'url("{url}")', { weight: '1 1000', style: 'normal' })`, added to `document.fonts` once per asset ID and `version`, then `load()`ed. The page policy already allows `font-src 'self' adman-asset:`.
- **One file, every weight.** An uploaded font file is registered for every weight, and `font-synthesis: none` stops the browser from making a false bold. So a variable font follows the weight field, and a font file with one weight draws that weight whatever the field says. The properties panel says so (`spec/editor.md`).
- **The bundled default font** is Inter, variable (weights 100 to 900), SIL Open Font Licence 1.1: `src/shared/scene/fonts/InterVariable.woff2` with `OFL.txt` beside it. The developer takes the file from the font's official release, and the slice report gives its SHA-256. It is imported with Vite's `?url`, so it is built into the page and loaded from `'self'`. It is registered once, when the Scene module loads, with weight `100 900`. It is listed in `THIRD-PARTY-NOTICES.md` (Phase 11). It lives in `src/shared/scene/fonts/`, not in `resources/`.
- **A font that fails** (file missing, not a font, still loading) leaves the text in `adman-default`. The variant's `missingFile` badge counts fonts (`spec/api-queries-events.md`).

### Settling and the overflow measurement

[REQ: FR-098, FR-249]

- After each change of `layers` or `assets` the Scene waits until it is settled: every font face it uses has loaded or failed, and every `<img>` it shows has decoded or failed (`img.decode()`). Then it waits two animation frames and measures. A settle that a newer change overtook is dropped.
- **`measureOverflow(box)`** is the one test: the text box overflows when `box.scrollHeight − box.clientHeight > 1` or `box.scrollWidth − box.clientWidth > 1`, in variant pixels. The 1 pixel allows for rounding between systems.
- Every text layer is measured, hidden ones included (they keep their place). An empty copy never overflows.
- The Scene then calls `onSettled({ overflow })` with one entry per text layer ID. It writes nothing itself.
- **Who reports.** The editor window and the render service each compare the result with the stored `layer.overflow` and send `layer.reportOverflow` for each layer that differs, naming the `variant.rev` they drew (`spec/editor-commands.md`). Both use this one test, so they agree. The editor reports only from saved values, never during a drag. A report for an older `rev` changes nothing.
- The badge: `VariantBadges.overflow` is true when any layer of the variant has `overflow` true (built). The editor shows a mark on the layer and a banner (`spec/editor.md`).

### What the Scene never does

- It reads no file, makes no network request other than the `adman-asset://` addresses it is given and the bundled font, and calls no `window.api` or `window.renderApi`.
- It draws copy, layer names and display names as text, never as HTML. No `dangerouslySetInnerHTML`.
- It has no timers apart from waiting to settle, and no animation in Phase 3. Phase 7's presets are plain functions of `timeMs` (R-14).

## Font names at import

Not built (Phase 3). Security class: the app reads bytes of a file it did not make. [REQ: FR-056]

- `readFontFamily(bytes): string | null` in `src/main/assets/font-name.ts`, pure, no Electron. It reads the `name` table of a TTF or OTF file, and of a WOFF2 file after decompressing it with Node's `zlib.brotliDecompressSync` with `maxOutputLength` 32 MiB.
- It takes name ID 16 (typographic family) when present, else name ID 1 (family). Platform 3 (Windows, UTF-16 big-endian) is preferred; else platform 1 encoding 0 (Mac Roman). English (language 0x0409, or 0 on platform 1) is preferred, else the first record.
- The result is trimmed, control characters are removed, and it is cut to 100 characters. Empty gives null.
- It never throws to its caller: any bound check that fails (a table or string past the end of the data, a count too large, a bad WOFF2 header, too much data after decompressing) gives null. No parser text reaches a log or an error.
- It is called wherever the app reads an asset's file facts for kind `font`: import, relink and the change check (`readFileFacts`). It fills `asset.font_family`. The bytes it reads are those already read for hashing; it opens no other file.
- `font_family` is drawn as text only (the font picker). It is never used to find a file or build a path.
- Tests: `tests/unit/main/assets/font-name.test.ts` (below in `spec/testing.md`).

## The render window

Not built (Phase 3). Security class, full review. [Review item LP-1]

A hidden Electron window that draws one Scene at a time so the main process can take a picture of it. It is new attack surface: it shares the main process with the app window. Its rules are in `spec/security.md`, "Rules: the render window"; this section says how it works.

### Files

| File | Holds | Electron |
|------|-------|----------|
| `src/main/render/render-window.ts` | Makes the window, loads the page, applies the navigation rules, closes it | Yes |
| `src/main/render/draw.ts` | `createDraw(): DrawScene`, the Electron side of a draw | Yes |
| `src/main/render/render-page.ts` | `renderPageAddress(opts)`, pure: the page address, by the same rule as `pageAddress` | No (pure, but lives at the edge) |
| `src/main/render/done-message.ts` | `acceptDone(event, expected)`, pure: checks a reply's sender and shape | No |
| `src/preload/render.ts` | The render window's bridge, `window.renderApi` | — |
| `src/renderer/render.html` | The page. Built with the app page, so it carries the same content security policy | — |
| `src/renderer/render-worker/` | `main.tsx` and `render-root/`: mounts the Scene and answers requests | — |
| `src/shared/schemas/render.ts` | `RENDER_CHANNELS`, the `RenderRequest` and `RenderDone` schemas | — |

`electron.vite.config.ts` builds two pages (`index.html`, `render.html`) and two preload files (`index.cjs`, `render.cjs`).

### Life of the window

- Made on the first draw, never before the app window. One render window at most.
- `show: false` and never shown. `skipTaskbar: true`, `frame: false`, `useContentSize: true`, `paintWhenInitiallyHidden: true`. `webPreferences`: the app window's settings (`contextIsolation`, `sandbox`, no Node, `webSecurity`), plus `offscreen: true`, `backgroundThrottling: false`, `devTools` only when the hand-test flag is on, and `preload` set to `render.cjs`.
- Its page is `render.html`, chosen by `renderPageAddress`: the development server's `/render.html` only when the app is not packaged and the address passes the `pageAddress` rule; the built page otherwise.
- The same navigation rules as the app window (`navigation.ts`): no navigation away, every new window denied.
- **Ended** when its page process crashes (`render-process-gone`), when it stops answering, after a draw that timed out, when the app window closes, and before quit. The next draw makes a new one.
- Closing the app window ends the render window first, so `window-all-closed` still quits the app (OI-23).
- `src/main/index.ts` keeps a reference to the app window. Every use that today takes `BrowserWindow.getAllWindows()[0]` (bringing the window forward, a second instance, a file opened by the system) uses that reference instead.

### One draw

`DrawScene = (input: SceneInput, size: { width: number; height: number }) => Promise<DrawResult>`, with `DrawResult = { png: Uint8Array; overflow: Record<string, boolean> }`. The type is in `src/main/thumbnails/types.ts` (no Electron). `src/main/index.ts` passes `createDraw()` to `createCore` as the option `drawScene`; the default throws `drawScene is not available`, as `toPng` does.

```ts
type SceneInput = {
  projectId: string
  variant: SceneVariant
  layers: LayerRow[]
  assets: Record<string, Omit<SceneAsset, 'url' | 'version'>>   // no addresses, no paths
  timeMs: number
  mode: 'full' | 'overlay-only'
}
```

1. Make the window if there is none. Set its content size to `size` (whole numbers, 1 to `RENDER_LIMITS.maxDimension`).
2. Send `RenderRequest = { requestId, input, width, height }` on `adman:render-request`. `requestId` is a new ULID.
3. The page (`render-root`) builds each asset's address with `assetUrl(projectId, id)`, sets `version` to 0, draws `<Scene mode={input.mode}>` scaled by `width / input.variant.width` from its top-left corner, waits for `onSettled`, and sends `RenderDone = { requestId, overflow }` on `adman:render-done`.
4. The main process takes the reply only through `acceptDone`: the sender must be the render window's own `webContents` and its main frame, the `requestId` must be the one it waits for, and the payload must pass the `RenderDone` schema. Overflow entries for IDs that are not text layers of the input are dropped. A reply that fails is ignored; the draw then times out.
5. `capturePage()`. If the picture is not exactly `width` × `height`, it is resized to that size (`quality: 'best'`). Then `toPNG()`.
6. Time limit `RENDER_LIMITS.timeMs` (10 seconds) from step 2 to step 5. On time-out the window is ended and the draw fails.

**Check first.** Before building on it, the developer checks on macOS, with a short throwaway script, that: (a) `capturePage()` of an offscreen window gives exactly `width` × `height` pixels on a Retina screen; (b) a 2048 × 2048 window can be made and captured; (c) `adman-asset://` pictures and fonts load in the render window; (d) `document.fonts`, `img.decode()` and `requestAnimationFrame` all run in the hidden offscreen window. If one fails, stop and report: the architect rules (for (a), the likely change is to take the `paint` event's picture instead).

`RENDER_LIMITS = { timeMs: 10_000, maxDimension: 2048, thumbnailSide: 512 }` in `src/shared/config/render.ts`, the one owner. Export (Phase 8) draws at full size, up to 8,192 pixels a side; how it gets past 2,048 is Phase 8's to design.

## The render service

Built: the types, the `render` field and its wiring, and a stand-in service that draws, writes and sends nothing (`thumbnail` gives `failed`, `render` throws, `onEvent` and `projectClosed` do nothing). Not built (Phase 3): the service itself. Files: `src/main/thumbnails/` (no Electron; core may import it).

| File | Holds |
|------|-------|
| `types.ts` | `DrawScene`, `DrawResult`, `RenderService`. Built. |
| `service.ts` | `createRenderService(opts)`. Built as the stand-in. |
| `scene-input.ts` | `sceneInput(project, variantId)`: reads the variant, its layers and the assets they name through `rows.ts`, with `missing` from `AssetService.missingAssetIds` |
| `queue.ts` | One draw at a time, with priorities |
| `paths.ts` | `thumbnailDir`, `thumbnailFile`: the one owner of the thumbnail file names |
| `cache.ts` | Read, write and clean thumbnail files |

`CoreDeps.render: RenderService` (the sixteenth field) is built once in `core.ts` as `createRenderService({ deps: () => deps, bus: () => bus, emit, draw: opts.drawScene ?? noDraw })`, the same late binding the job runner uses. `tests/integration/registration.test.ts` lists it.

```ts
type RenderService = {
  thumbnail(project: ProjectHandle, variantId: string): Promise<ThumbnailGet>
  render(project: ProjectHandle, variantId: string, maxDimension: number): Promise<VariantRender>
  onEvent(event: BusEvent): void
  projectClosed(projectId: string): Promise<void>
}
```

- **Queue.** One draw at a time for the whole app. A `variant.render` query goes first; thumbnails after, oldest request first. Thumbnail requests for the same project and variant are merged: the input is read when the draw starts, so it always draws the latest `rev`.
- **Eager thumbnails.** `onEvent` sees every event the main process sends: `send` in `src/main/index.ts` hands each one to the app window and calls `core.deps.render.onEvent(event)`. For each `variant` row in a `project.changed` it schedules a thumbnail once that variant has been quiet for 1 second. A `removed.variant` drops it. So the overflow mark is kept current after an agent's edit too.
- **Changed files.** For `asset.changedOnDisk`, it finds the variants of that project whose layers name one of the assets as `source` or `style.fontAssetId`, deletes their thumbnail file for the current `rev`, schedules them again, and sends `thumbnail.changed` for each.
- **After a draw.** For a thumbnail, it writes the file (below) and sends `thumbnail.changed { projectId, variantId }`. For any draw, it compares `overflow` with each text layer's stored value and sends `layer.reportOverflow { projectId, layerId, overflow, variantRev }` through the bus for each that differs, with actor `user` (as `asset.checkChanged` does; the command is denied to agents).
- **A project that is no longer open** when its draw starts is skipped.
- **Failure** (draw time-out, crash, throw): one `warn` log line, `event: 'app'`, `name: 'render.draw'`, the project and variant IDs, message "A picture of a variant could not be drawn.", `context.reason` one of `timeout`, `crashed`, `error`. No path, no copy text, no error text. The thumbnail for that `rev` is marked failed until the `rev` changes, its files change on disk, or the app restarts. `variant.render` answers `render_failed`.
- **`projectClosed(projectId)`** is awaited by `project.close` after the file closes. It drops queued draws of that project and cleans its thumbnail folder (below). It never throws: a failed clean-up is logged and the close still succeeds.

## Thumbnails

Not built (Phase 3). Security class, short review: file names come from project-file values, and the service deletes files. [REQ: FR-074 grid thumbnails]

- **Where.** `{userData}/thumbnails/{projectId}/{variantId}-{rev}.png` (`spec/data-rules.md`, "Caching"). PNG, longest side `RENDER_LIMITS.thumbnailSide` (512), the other side `round(512 × short / long)`, at least 1.
- **Names are checked before use.** `thumbnailFile` throws, and nothing is read or written, unless `projectId` is a ULID, `variantId` matches `^[23456789abcdefghjkmnpqrstuvwxyz]{6}$` and `rev` is a whole number from 0 to `Number.MAX_SAFE_INTEGER`. These values come from the project file.
- **Writing.** The project folder is made with `mkdir` only under `{userData}/thumbnails/`, after an `lstat` shows that `thumbnails/` and `thumbnails/{projectId}` are real folders or absent; a link refuses and nothing is written. The file is written to `{name}.partial` with the `wx` flag and renamed over the name. A file that is already there for that `rev` is left as it is.
- **Reading** (`thumbnail.get`, `spec/editor-commands.md`): a regular file by `lstat`, at most 8 MiB, else treated as absent.
- **Cleaning** on project close: in `{userData}/thumbnails/{projectId}/` only, not in sub-folders, delete each regular file (by `lstat`; links are left alone) whose name matches `^{variant pattern}-\d+\.png$` or `\.partial$` and that is not the current `rev` of a variant still in the project. Nothing else is ever deleted. The folder's real path must be inside the real path of `{userData}/thumbnails/`, else nothing is deleted.
- **Asset thumbnails are not made.** The window draws asset pictures straight from `adman-asset://` (the reference picker already does). The "asset thumbnail" row of `spec/data-rules.md`, "Caching", is not built until a library view proves slow (A-30).
- **Accepted:** two copies of one project file made outside the app share a project ID and variant IDs, so one may show the other's thumbnail for the same `rev`. A wrong preview only; the next change redraws it.

## Left for later phases

- Time, presets and background clips in the Scene (Phase 7).
- Drawing at full size past 2,048 pixels, and the exported-file test of FR-245 (Phase 8).
- `render_variant` for agents (Phase 10) calls `variant.render`; its `hide_text` choice adds a Scene prop then.
- A WebP decoder window (slice WP) is a separate hidden window with its own rules; it does not share the render window.
