// The layer tools (spec/phases/phase-10.md, A-233; spec/editor-commands.md). Each runs one layer
// command whose agent policy is allow; its input is the command's own strict schema, so a
// picture is named only by an asset ID of the project and a translation's status is not a
// field. The command stamps variant.agent_changed_at and puts the edit on the variant's undo
// list. Every reply is the one ID the command gives, through a picker.
import {
  layerCreateInput,
  layerDeleteInput,
  layerReorderInput,
  layerUpdateInput,
  layerUpdateManyInput,
} from '@/shared/schemas/commands/layer'
import { layerIdOnly, layerIdsOnly, variantIdOnly } from './layer-replies'
import type { ToolDef } from './table'
import { LEAVE_THE_CHOICE } from './tool-words'

const SOURCE =
  'A picture is set as source: { assetId } with an asset ID from list_assets (asset library, ' +
  'kind image); source null clears it. A font is set as style.fontAssetId with a font asset ' +
  `ID, or null for the default font. ${LEAVE_THE_CHOICE}`

const FIELDS =
  'Fields: name, visible, locked, copy (text layers), style (merged into the stored style), ' +
  'geometry (x, y, width, height, rotation, crop; merged), source, timing, animation.'

const UNDO = 'The user can undo the change.'

export const LAYER_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_layer',
    description:
      'Add a picture or text layer on top of one variant of an open project. type is "image" ' +
      'or "text"; values may set name, copy, style, geometry, source, visible and locked. ' +
      `Gives the new layer ID. ${UNDO} ${SOURCE}`,
    kind: 'command',
    target: 'layer.create',
    input: layerCreateInput,
    reply: layerIdOnly,
  },
  {
    name: 'update_layer',
    description:
      'Change one layer of an open project. patch holds only the fields to change. ' +
      `${FIELDS} Gives the layer ID. ${UNDO} ${SOURCE}`,
    kind: 'command',
    target: 'layer.update',
    input: layerUpdateInput,
    reply: layerIdOnly,
  },
  {
    name: 'update_layers',
    description:
      'Change several layers of one variant of an open project as one step. updates is a list ' +
      `of { layerId, patch } (up to 100), each patch as in update_layer. ${FIELDS} Gives the ` +
      `IDs of the layers that changed. ${UNDO} ${SOURCE}`,
    kind: 'command',
    target: 'layer.updateMany',
    input: layerUpdateManyInput,
    reply: layerIdsOnly,
  },
  {
    name: 'delete_layer',
    description:
      'Delete one layer of an open project. The background layer cannot be deleted. Gives the ' +
      `layer ID. ${UNDO}`,
    kind: 'command',
    target: 'layer.delete',
    input: layerDeleteInput,
    reply: layerIdOnly,
  },
  {
    name: 'reorder_layers',
    description:
      'Set the stacking order of one variant of an open project. layer_ids lists every layer ' +
      'of the variant except the background, each once, lowest first. Gives the variant ID. ' +
      UNDO,
    kind: 'command',
    target: 'layer.reorder',
    input: layerReorderInput,
    reply: variantIdOnly,
  },
]
