/**
 * State Clustering for Exploratory Automata Analysis
 * Groups states by their future continuation / k-tail acceptance profiles.
 */

import { normalizeDfaAutomaton } from './automata.js';

/**
 * Computes k-tail suffixes up to length k.
 */
function getSuffixes(alphabet, k = 2) {
  const suffixes = [''];
  let layer = [''];
  for (let i = 1; i <= k; i++) {
    const nextLayer = [];
    layer.forEach(pref => {
      alphabet.forEach(sym => {
        nextLayer.push(pref + sym);
      });
    });
    suffixes.push(...nextLayer);
    layer = nextLayer;
  }
  return suffixes;
}

/**
 * Clusters states of a DFA based on their k-tail future behavior.
 */
export function clusterDfaStates(rawDfa, k = 2) {
  if (!rawDfa) return { clusters: [], suffixes: [] };
  const dfa = normalizeDfaAutomaton(rawDfa);
  const { states, alphabet, acceptStates, transitions } = dfa;

  const suffixes = getSuffixes(alphabet, k);
  const acceptSet = new Set(acceptStates);

  // Helper to trace from a state
  function traceSuffix(startState, suffix) {
    let curr = startState;
    for (const char of suffix) {
      const next = transitions[curr]?.[char];
      if (!next) return false;
      curr = next;
    }
    return acceptSet.has(curr);
  }

  // Feature vector per state: boolean array for each suffix
  const stateProfiles = {};
  states.forEach(s => {
    stateProfiles[s] = suffixes.map(suf => traceSuffix(s, suf));
  });

  // Group states with identical profile signatures
  const clusterMap = new Map();
  states.forEach(s => {
    const signature = stateProfiles[s].map(v => (v ? '1' : '0')).join('');
    if (!clusterMap.has(signature)) {
      clusterMap.set(signature, []);
    }
    clusterMap.get(signature).push(s);
  });

  const clusters = [];
  let clusterId = 1;

  clusterMap.forEach((memberStates, signature) => {
    const acceptedSuffixes = suffixes.filter((_, idx) => signature[idx] === '1');
    clusters.push({
      id: `Cluster ${clusterId++}`,
      states: memberStates,
      size: memberStates.length,
      isAcceptingCluster: memberStates.some(s => acceptSet.has(s)),
      acceptedSuffixes: acceptedSuffixes.length > 0 ? acceptedSuffixes.map(s => (s === '' ? 'ε' : s)) : ['(none)'],
      signature,
    });
  });

  return {
    clusters,
    suffixes: suffixes.map(s => (s === '' ? 'ε' : s)),
    stateProfiles,
  };
}
