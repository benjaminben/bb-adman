// SPEC 3.3 "Smallest and largest side" [1.26]: the one owner of the campaign size range.
// Each side is from MIN_SIZE_SIDE to MAX_SIZE_SIDE pixels, both included. parseSize and the
// CampaignSize schema read these; neither holds the numbers.
export const MIN_SIZE_SIDE = 50
export const MAX_SIZE_SIDE = 8192
