import type { Actor } from '../../shared/schemas/events'

// Queries carry an actor set like a command's (SPEC 4.1). No Phase 1 query checks it;
// mcp.getConnectInfo (Phase 10) refuses the agent.
export type QueryOptions = { actor: Actor }

export type QueryFn = (input: unknown, opts: QueryOptions) => unknown | Promise<unknown>
