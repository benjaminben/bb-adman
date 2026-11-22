// DLG-2: the words of the three confirm dialogs, captured from `main` (e7d29cc2) before the
// markup changed: every trimmed text node in document order, and the accessible description.
// The one difference allowed is the delete warning's description, which DLG-2 adds (it was
// empty); its words are the body line that was already there.
const TITLE_H3 =
  'MiniMax H3 requires a commercial license, please confirm that you have one before production use'
const TITLE_UNKNOWN =
  'This model requires a commercial license, please confirm that you have one before production use'
const CAMPAIGN_TARGET = 'Campaign "Summer Splash!" (6 variants) in "Spring Work"'
const VARIANT_TARGET = 'Variant "Hero · 9x16 · de" in campaign "Summer Splash!" in "Spring Work"'
const VARIANT_COST = 'This cannot be undone. It also clears the undo list of this campaign.'
const IMPORT_COST =
  'Once imported, agents can place these files in ads and send pictures to AI providers you allowed.'
const IMPORT_LINE = 'An agent wants to import files: 3 files into "Lakeside Beauty".'
const FILES = ['/tmp/a/one.jpg', '/tmp/a/two.png', '/tmp/a/three.jpg']
const TICK = ['Answer within 2 minutes.', "Don't ask again for deletes"]
const WAIT_ALLOW = ['Allow', 'can be pressed in a moment.']
const WAIT_IMPORT = ['Import', 'can be pressed in a moment.']

const CAMPAIGN_HEAD = [
  'An agent asks to delete',
  'An agent',
  'wants to',
  'delete campaigns',
  ':',
  CAMPAIGN_TARGET,
  '.',
]
const VARIANT_HEAD = [
  'An agent asks to delete',
  'Agent named',
  'Planner',
  'wants to',
  'delete variants',
  ':',
  VARIANT_TARGET,
  '.',
]
const IMPORT_HEAD = [
  'An agent asks to import files',
  'An agent',
  'wants to',
  'import files',
  ':',
  '3 files into "Lakeside Beauty"',
  '.',
  ...FILES,
]

export const STRINGS = {
  delete: {
    pieces: ['Delete German post?', 'This cannot be undone.', 'Keep', 'Delete variant'],
    description: 'This cannot be undone.',
  },
  deleteRefused: {
    pieces: [
      'Delete German post?',
      'This cannot be undone.',
      'Work is still running for this variant. Stop it, or wait for it to finish.',
      'Keep',
      'Delete variant',
    ],
    description: 'This cannot be undone.',
  },
  licence: {
    pieces: [TITLE_H3, "don't show again for", 'MiniMax H3', 'Cancel', 'Confirm'],
    description: '',
  },
  licenceSaving: {
    pieces: [TITLE_H3, "don't show again for", 'MiniMax H3', 'Cancel', 'Saving…'],
    description: '',
  },
  licenceUnknown: { pieces: [TITLE_UNKNOWN, 'Cancel', 'Confirm'], description: '' },
  askCampaignWaiting: {
    pieces: [...CAMPAIGN_HEAD, ...TICK, 'This cannot be undone.', 'Refuse', 'Allow', ...WAIT_ALLOW],
    description: 'This cannot be undone.',
  },
  askCampaignReady: {
    pieces: [...CAMPAIGN_HEAD, ...TICK, 'This cannot be undone.', 'Refuse', 'Allow'],
    description: 'This cannot be undone.',
  },
  askCampaignRefused: {
    pieces: [...CAMPAIGN_HEAD, 'That request has ended.', 'This cannot be undone.', 'Close'],
    description: 'This cannot be undone.',
  },
  askVariantWaiting: {
    pieces: [...VARIANT_HEAD, ...TICK, VARIANT_COST, 'Refuse', 'Allow', ...WAIT_ALLOW],
    description: VARIANT_COST,
  },
  askVariantReady: {
    pieces: [...VARIANT_HEAD, ...TICK, VARIANT_COST, 'Refuse', 'Allow'],
    description: VARIANT_COST,
  },
  askVariantRefused: {
    pieces: [...VARIANT_HEAD, 'That request has ended.', VARIANT_COST, 'Close'],
    description: VARIANT_COST,
  },
  askImportWaiting: {
    pieces: [...IMPORT_HEAD, IMPORT_COST, 'Refuse', 'Import', ...WAIT_IMPORT],
    description: `${IMPORT_LINE} ${IMPORT_COST}`,
  },
  askImportReady: {
    pieces: [...IMPORT_HEAD, IMPORT_COST, 'Refuse', 'Import'],
    description: `${IMPORT_LINE} ${IMPORT_COST}`,
  },
  askImportRefused: {
    pieces: [...IMPORT_HEAD, 'That request has ended.', IMPORT_COST, 'Close'],
    description: `${IMPORT_LINE} ${IMPORT_COST}`,
  },
}
