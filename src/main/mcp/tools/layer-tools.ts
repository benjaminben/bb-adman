// The layer tools (spec/phases/phase-10.md, A-233). Not built: P10-4 replaces these rows.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const LAYER_TOOLS: readonly ToolDef[] = [
  notBuilt('create_layer', 'command', 'layer.create'),
  notBuilt('update_layer', 'command', 'layer.update'),
  notBuilt('update_layers', 'command', 'layer.updateMany'),
  notBuilt('delete_layer', 'command', 'layer.delete'),
  notBuilt('reorder_layers', 'command', 'layer.reorder'),
]
