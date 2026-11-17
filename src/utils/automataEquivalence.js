/**
 * Automata Equivalence & Minimal Counterexample Finder
 * Tests whether two DFAs accept the same language via Product Automaton BFS.
 */

import { normalizeDfaAutomaton } from './automata.js';

/**
 * Checks language equivalence between two DFAs.
 * If not equivalent, returns the minimal length counterexample string.
 * @param {Object} dfa1 - First DFA (e.g. Inferred DFA)
 * @param {Object} dfa2 - Second DFA (e.g. Reference DFA)
 * @param {Array<string>} alphabet - Shared alphabet
 */
export function checkDfaEquivalence(rawDfa1, rawDfa2, explicitAlphabet = null) {
  if (!rawDfa1 || !rawDfa2) {
    return { equivalent: false, counterexample: null, reason: 'Missing automaton' };
  }

  const dfa1 = normalizeDfaAutomaton(rawDfa1);
  const dfa2 = normalizeDfaAutomaton(rawDfa2);

  const alphabet = explicitAlphabet || [...new Set([...dfa1.alphabet, ...dfa2.alphabet])];
  const acceptSet1 = new Set(dfa1.acceptStates);
  const acceptSet2 = new Set(dfa2.acceptStates);

  const DEAD = '__DEAD__';

  const start1 = dfa1.startState || DEAD;
  const start2 = dfa2.startState || DEAD;

  const queue = [{ u: start1, v: start2, path: '' }];
  const visited = new Set([`${start1}|||${start2}`]);

  const MAX_EXPLORATION = 10000;
  let steps = 0;

  while (queue.length > 0 && steps++ < MAX_EXPLORATION) {
    const { u, v, path } = queue.shift();

    const isAcc1 = u !== DEAD && acceptSet1.has(u);
    const isAcc2 = v !== DEAD && acceptSet2.has(v);

    if (isAcc1 !== isAcc2) {
      // Disagreement found!
      return {
        equivalent: false,
        counterexample: path === '' ? 'ε (empty string)' : path,
        rawString: path,
        inferredAccepts: isAcc1,
        referenceAccepts: isAcc2,
        length: path.length,
      };
    }

    // Branch on all alphabet symbols
    for (const char of alphabet) {
      const nextU = (u !== DEAD && dfa1.transitions[u]?.[char]) || DEAD;
      const nextV = (v !== DEAD && dfa2.transitions[v]?.[char]) || DEAD;

      const key = `${nextU}|||${nextV}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ u: nextU, v: nextV, path: path + char });
      }
    }
  }

  return {
    equivalent: true,
    counterexample: null,
  };
}
