// The words of the six checks (spec/phases/phase-06.md, design addition 5).
export const CHECK_MESSAGES = {
  assetNotShown: (name: string) => `${name} is not shown on this post.`,
  colourOutsidePalette: (layer: string, colour: string) =>
    `${layer} uses ${colour}, which is not in the palette.`,
  containsProhibited: (layer: string, entry: string) => `${layer} contains “${entry}”.`,
  requiredMissing: (entry: string) => `“${entry}” is not in this post's text.`,
  notApproved: (layer: string) => `${layer}: the translation is not approved.`,
  noTranslation: (layer: string) => `${layer} has no translation yet.`,
  overflows: (layer: string) => `${layer} does not fit its box.`,
  noRequiredFiles: 'The campaign has no required files.',
  emptyPalette: 'The palette is empty.',
  noProhibitedWords: (language: string) => `There are no prohibited words for ${language}.`,
  noRequiredWords: (language: string) => `There are no required words for ${language}.`,
  mainLanguage: 'This post is in the main language.',
} as const
