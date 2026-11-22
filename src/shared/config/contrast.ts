// The numbers of the readable-text check after "Place text with AI" (spec/phases/
// round-2-editor.md D2, "The rule").

// The contrast every placed text must reach, for every text size (WCAG AA for normal text).
export const TEXT_CONTRAST_MIN = 4.5

// About this many pixels are sampled under one box.
export const GROUND_SAMPLES = 4096

// The ground's dark and light parts: these percentiles of the samples' luminance.
export const GROUND_DARK_PERCENTILE = 0.1
export const GROUND_LIGHT_PERCENTILE = 0.9

// A text box's padding when the layer has none: this share of the font size.
export const BOX_PADDING_SHARE = 0.25
