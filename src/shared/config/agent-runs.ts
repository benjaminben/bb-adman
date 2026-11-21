// SPEC 6.11.3 [1.24]: the one owner of the limit on runs an agent starts. The gate counts
// an agent's jobs that are queued or running for one provider, over every open project.
// A default until CQ-20 is answered.
export const AGENT_MAX_ACTIVE_RUNS = 4
