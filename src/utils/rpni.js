/**
 * RPNI (Regular Positive and Negative Inference)
 * Learns a minimal DFA from positive (S+) and negative (S-) string examples.
 */

import { normalizeDfaAutomaton } from './automata.js';

/**
 * Builds a Prefix Tree Acceptor (PTA) from positive strings.
 * The PTA is a tree-shaped DFA accepting exactly S+.
 */
export function buildPTA(positiveStrings, alphabet) {
  const cleanPos = [...new Set(positiveStrings.map(s => String(s ?? '')))];
  
  // Collect all prefixes
  const prefixes = new Set(['']);
  cleanPos.forEach(str => {
    for (let i = 0; i <= str.length; i++) {
      prefixes.add(str.slice(0, i));
    }
  });

  // Canonical ordering: length first, then lexicographical
  const prefixList = [...prefixes].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  // State ID mapping: prefix -> stateId (q0 is root "")
  const stateMap = new Map();
  prefixList.forEach((pref, idx) => {
    stateMap.set(pref, `q${idx}`);
  });

  const states = prefixList.map(pref => stateMap.get(pref));
  const startState = stateMap.get('');
  const acceptStates = cleanPos.map(str => stateMap.get(str)).filter(Boolean);

  const transitions = {};
  states.forEach(s => { transitions[s] = {}; });

  prefixList.forEach(pref => {
    const fromState = stateMap.get(pref);
    alphabet.forEach(symbol => {
      const nextPref = pref + symbol;
      if (stateMap.has(nextPref)) {
        transitions[fromState][symbol] = stateMap.get(nextPref);
      }
    });
  });

  return normalizeDfaAutomaton({
    states,
    alphabet,
    startState,
    acceptStates,
    transitions,
    meta: {
      type: 'PTA',
      stateMap: Object.fromEntries(prefixList.map(p => [stateMap.get(p), p])),
    },
  });
}

/**
 * Checks if a candidate automaton accepts any string in S-.
 */
function isConsistentWithNegatives(automaton, negativeStrings) {
  const { startState, acceptStates, transitions, alphabet } = automaton;

  for (const neg of negativeStrings) {
    let current = startState;
    let failed = false;

    for (const char of neg) {
      if (!alphabet.includes(char)) {
        failed = true;
        break;
      }
      const next = transitions[current]?.[char];
      if (!next) {
        failed = true;
        break;
      }
      current = next;
    }

    // If string was fully consumed and ended in an accepting state, it is INCONSISTENT
    if (!failed && acceptStates.includes(current)) {
      return { consistent: false, conflictingString: neg };
    }
  }

  return { consistent: true, conflictingString: null };
}

/**
 * Prunes unreachable states from the start state.
 */
function pruneUnreachable(dfa) {
  const visited = new Set();
  const queue = [dfa.startState];
  visited.add(dfa.startState);

  while (queue.length > 0) {
    const s = queue.shift();
    dfa.alphabet.forEach(a => {
      const next = dfa.transitions[s]?.[a];
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }

  const newStates = dfa.states.filter(s => visited.has(s));
  const newAccepts = dfa.acceptStates.filter(s => visited.has(s));
  const newTransitions = {};

  newStates.forEach(s => {
    newTransitions[s] = {};
    dfa.alphabet.forEach(a => {
      const next = dfa.transitions[s]?.[a];
      if (next && visited.has(next)) {
        newTransitions[s][a] = next;
      }
    });
  });

  return {
    states: newStates,
    alphabet: dfa.alphabet,
    startState: dfa.startState,
    acceptStates: newAccepts,
    transitions: newTransitions,
  };
}

/**
 * Performs state merging and determinization fold using a disjoint-set (Union-Find).
 */
function foldMerge(baseAutomaton, qRed, qBlue) {
  const states = [...baseAutomaton.states];
  const alphabet = [...baseAutomaton.alphabet];

  // Disjoint-set data structure
  const parent = {};
  states.forEach(s => { parent[s] = s; });

  function find(i) {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }

  // Copy transitions
  const workingTransitions = {};
  states.forEach(s => {
    workingTransitions[s] = {};
    alphabet.forEach(a => {
      workingTransitions[s][a] = baseAutomaton.transitions[s]?.[a] || null;
    });
  });

  let foldCount = 0;
  const queue = [[qRed, qBlue]];

  while (queue.length > 0) {
    const [u, v] = queue.shift();
    const rootU = find(u);
    const rootV = find(v);

    if (rootU === rootV) continue;

    // Merge rootV into rootU
    parent[rootV] = rootU;
    foldCount++;

    for (const a of alphabet) {
      const tU = workingTransitions[rootU][a];
      const tV = workingTransitions[rootV][a];

      if (tU && tV) {
        queue.push([tU, tV]);
      } else if (tV) {
        workingTransitions[rootU][a] = tV;
      }
    }
  }

  // Construct folded automaton
  const survivingRoots = [...new Set(states.map(find))];
  const newTransitions = {};
  const originalAccepts = new Set(baseAutomaton.acceptStates);
  const newAcceptStates = [];

  survivingRoots.forEach(r => {
    newTransitions[r] = {};
    alphabet.forEach(a => {
      const target = workingTransitions[r]?.[a];
      if (target) {
        newTransitions[r][a] = find(target);
      }
    });

    const isAcc = states.some(s => find(s) === r && originalAccepts.has(s));
    if (isAcc) newAcceptStates.push(r);
  });

  const rawFolded = {
    states: survivingRoots,
    alphabet,
    startState: find(baseAutomaton.startState),
    acceptStates: newAcceptStates,
    transitions: newTransitions,
  };

  const foldedDFA = pruneUnreachable(rawFolded);

  return { foldedDFA, foldCount: Math.max(0, foldCount - 1) };
}

/**
 * Standard RPNI Algorithm.
 * Learns a DFA consistent with positive and negative strings.
 * Records step-by-step merge attempts and decisions for educational inspection.
 */
export function rpni(positiveStrings, negativeStrings, alphabetInput = null) {
  // Clean inputs
  const cleanPos = [...new Set(positiveStrings.map(s => String(s ?? '')))];
  const cleanNeg = [...new Set(negativeStrings.map(s => String(s ?? '')))];

  // Derive alphabet if not explicitly given
  const allStrings = [...cleanPos, ...cleanNeg];
  const alphabet = alphabetInput && alphabetInput.length > 0
    ? [...new Set(alphabetInput)]
    : [...new Set(allStrings.flatMap(s => (s ? s.split('') : [])))].sort();

  if (alphabet.length === 0) alphabet.push('a');

  // Step 1: Build Prefix Tree Acceptor
  const pta = buildPTA(cleanPos, alphabet);
  const steps = [];

  // If no positive strings, return trivial rejecting DFA
  if (cleanPos.length === 0) {
    const emptyDfa = normalizeDfaAutomaton({
      states: ['q0'],
      alphabet,
      startState: 'q0',
      acceptStates: [],
      transitions: { q0: {} },
    });
    return { pta: emptyDfa, inferredDFA: emptyDfa, steps: [] };
  }

  let currentAutomaton = JSON.parse(JSON.stringify(pta));
  const redStates = [currentAutomaton.startState]; // Start state is red

  // Blue states: all children of current RED states not in RED
  function getBlueStates(currAut, reds) {
    const blues = new Set();
    const redSet = new Set(reds);
    reds.forEach(r => {
      currAut.alphabet.forEach(a => {
        const next = currAut.transitions[r]?.[a];
        if (next && !redSet.has(next)) {
          blues.add(next);
        }
      });
    });
    // Order blues according to current state list
    return [...blues].sort((a, b) => currAut.states.indexOf(a) - currAut.states.indexOf(b));
  }

  let stepCounter = 1;
  let blueList = getBlueStates(currentAutomaton, redStates);

  while (blueList.length > 0) {
    const qBlue = blueList[0];
    let merged = false;

    // Try to merge qBlue into an existing RED state
    for (const qRed of redStates) {
      const { foldedDFA, foldCount } = foldMerge(currentAutomaton, qRed, qBlue);
      const { consistent, conflictingString } = isConsistentWithNegatives(foldedDFA, cleanNeg);

      if (consistent) {
        // Merge accepted!
        steps.push({
          step: stepCounter++,
          action: 'MERGE_SUCCESS',
          redState: qRed,
          blueState: qBlue,
          foldCount,
          consistent: true,
          conflictingString: null,
          stateCount: foldedDFA.states.length,
          explanation: `Merged candidate state ${qBlue} into core state ${qRed} (${foldCount} recursive folds). Consistent with all ${cleanNeg.length} negative strings.`,
        });

        currentAutomaton = foldedDFA;
        merged = true;
        break;
      } else {
        // Inconsistent merge rejected
        steps.push({
          step: stepCounter++,
          action: 'MERGE_FAILED',
          redState: qRed,
          blueState: qBlue,
          foldCount,
          consistent: false,
          conflictingString,
          stateCount: currentAutomaton.states.length,
          explanation: `Attempted merge ${qBlue} → ${qRed} rejected: would accept negative string "${conflictingString}".`,
        });
      }
    }

    if (!merged) {
      // Promote qBlue to RED
      redStates.push(qBlue);
      steps.push({
        step: stepCounter++,
        action: 'PROMOTE_TO_RED',
        redState: null,
        blueState: qBlue,
        consistent: true,
        conflictingString: null,
        stateCount: currentAutomaton.states.length,
        explanation: `State ${qBlue} could not be merged with any existing core states. Promoted ${qBlue} to a distinct core state.`,
      });
    }

    blueList = getBlueStates(currentAutomaton, redStates);
  }

  // Renumber states to clean q0, q1, ...
  const stateRenameMap = new Map();
  currentAutomaton.states.forEach((s, i) => {
    stateRenameMap.set(s, `q${i}`);
  });

  const finalStates = currentAutomaton.states.map(s => stateRenameMap.get(s));
  const finalStart = stateRenameMap.get(currentAutomaton.startState);
  const finalAccept = currentAutomaton.acceptStates.map(s => stateRenameMap.get(s));
  const finalTransitions = {};

  finalStates.forEach(s => { finalTransitions[s] = {}; });
  currentAutomaton.states.forEach(s => {
    const fromName = stateRenameMap.get(s);
    alphabet.forEach(a => {
      const tgt = currentAutomaton.transitions[s]?.[a];
      if (tgt && stateRenameMap.has(tgt)) {
        finalTransitions[fromName][a] = stateRenameMap.get(tgt);
      }
    });
  });

  const inferredDFA = normalizeDfaAutomaton({
    states: finalStates,
    alphabet,
    startState: finalStart,
    acceptStates: finalAccept,
    transitions: finalTransitions,
  });

  return {
    pta,
    inferredDFA,
    steps,
  };
}
