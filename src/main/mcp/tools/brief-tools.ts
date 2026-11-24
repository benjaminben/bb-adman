// create_campaign_from_brief (spec/phases/round-2-platform.md, D6): a campaign from brief text.
// The tool reads the text with parseBriefText (no AI call) only to pick the command: any
// picture that is a full path runs campaign.createFromBriefWithFiles, which the user is asked
// about every time; any other brief, a text that cannot be read included, runs the plain
// campaign.createFromBrief, which refuses what it cannot use. The reply is IDs only.
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import { parseBriefText } from '@/shared/brief/text'
import { pictureRef } from '@/shared/brief/picture-refs'
import { briefCreatedFields } from './brief-replies'
import type { ToolDef } from './table'
import { LEAVE_THE_CHOICE } from './tool-words'

const PLAIN = 'campaign.createFromBrief'
const WITH_FILES = 'campaign.createFromBriefWithFiles'

function namesAFile(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const read = parseBriefText(text)
  if (!read.ok) return false
  return (read.data.draft.subjects ?? []).some((s) => {
    const pictures = typeof s.pictures === 'string' ? [s.pictures] : (s.pictures ?? [])
    return pictures.some((p) => pictureRef(p, process.platform).kind === 'file')
  })
}

export const BRIEF_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_campaign_from_brief',
    description:
      'Create a campaign in an open project from brief text in JSON, YAML or Markdown, with ' +
      'the same fields as create_campaign’s brief. In Markdown, the first "# " heading is the ' +
      'campaign name, and "Label: value" lines or "## Label" sections give the rest: Region, ' +
      'Audience, Message, Offer, Call to action, Tone, Languages, Sizes, Required words, ' +
      'Prohibited words, Subjects (one "### Name" per subject, with ID, Description and ' +
      'Pictures), and "Copy (fr)", one per language, with Headline and Call to action. For ' +
      'example:\n' +
      '# Spring launch\nRegion: Canada\nAudience: Adults who buy tea online\n' +
      'Message: Warm up slowly\n## Subjects\n### Tea tin\n' +
      "A subject's pictures are asset IDs from list_assets or full file paths. If any full " +
      'path is given, the user is asked first and sees each path; you wait up to two ' +
      'minutes, and a refusal is final. A JSON or YAML brief may also give brand (logo, ' +
      'colours as hex such as #0B3D2E, fonts with heading and body), layout (a starter layout ' +
      'ID), artDirection (a line for the picture prompt) and adsPer ("campaign" or ' +
      '"subject"). The logo and fonts are asset IDs only: import a file with import_assets ' +
      'first. A path there, or a bad colour, layout or adsPer, is refused. ' +
      'Sizes and languages left out are filled as for ' +
      'create_campaign. Gives the campaign ID, its first direction ID, its master variant ID ' +
      'and the subject IDs, and the asset IDs of imported files. ' +
      LEAVE_THE_CHOICE,
    kind: 'command',
    target: PLAIN,
    targets: [PLAIN, WITH_FILES],
    pickTarget: (input) => (namesAFile(input.text) ? WITH_FILES : PLAIN),
    input: campaignFromBriefInput,
    reply: briefCreatedFields,
  },
]
