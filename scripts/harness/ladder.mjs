export const BRAIN_ALIASES = ['corteo-edit', 'corteo-draft', 'corteo-fast'];

export function ladderFor(alias, brain, probe) {
  if (!BRAIN_ALIASES.includes(alias)) {
    throw new Error(`unknown alias ${alias}: use corteo-edit, corteo-draft or corteo-fast`);
  }
  if (!probe) return [];
  const config = brain.aliases[alias];
  const lanes = config.order === 'listed' ? config.lanes : brain.candidates;
  const passing = lanes.filter((lane) => probe[lane]?.ok && (!config.needsProse || probe[lane].prose));
  return config.order === 'latency'
    ? passing.sort((a, b) => probe[a].latencyMs - probe[b].latencyMs)
    : passing;
}
