/**
 * Dataset Generator for Regular Languages
 * Generates training and testing string sets over configurable alphabets with optional noise.
 */

import { regexToENFA } from './regexToENFA.js';
import { compressNFA, subsetConstruction } from './nfaToDfa.js';
import { hopcroftMinimize } from './minimizeDFA.js';
import { normalizeDfaAutomaton, normalizeNfaAutomaton } from './automata.js';

export const LANGUAGE_PRESETS = [
  {
    id: 'ends_with_abb',
    name: "Ends with 'abb'",
    regex: '(a|b)*abb',
    alphabet: ['a', 'b'],
    description: "Strings ending with substring 'abb'",
  },
  {
    id: 'contains_aa',
    name: "Contains 'aa'",
    regex: '(a|b)*aa(a|b)*',
    alphabet: ['a', 'b'],
    description: "Strings containing consecutive 'aa'",
  },
  {
    id: 'ends_with_b',
    name: "Ends with 'b'",
    regex: '(a|b)*b',
    alphabet: ['a', 'b'],
    description: "Strings having 'b' as their final character",
  },
  {
    id: 'even_a',
    name: "Even number of 'a's",
    regex: 'b*(ab*ab*)*',
    alphabet: ['a', 'b'],
    description: "Strings containing an even count of 'a's (0, 2, 4...)",
  },
  {
    id: 'contains_101',
    name: "Binary contains '101'",
    regex: '(0|1)*101(0|1)*',
    alphabet: ['0', '1'],
    description: "Binary sequences containing '101'",
  },
  {
    id: 'alternating_ab',
    name: "Alternating 'a' and 'b'",
    regex: '(ab)*|a(ba)*|(ba)*|b(ab)*',
    alphabet: ['a', 'b'],
    description: "No two identical characters appear consecutively",
  },
];

/**
 * Builds a ground-truth minimal DFA from a regular expression.
 */
export function buildReferenceDFA(regex) {
  try {
    const enfa = normalizeNfaAutomaton(regexToENFA(regex));
    const cleanNfa = normalizeNfaAutomaton(compressNFA(enfa));
    const rawDfa = normalizeDfaAutomaton(subsetConstruction(cleanNfa));
    return normalizeDfaAutomaton(hopcroftMinimize(rawDfa));
  } catch (err) {
    console.error('Failed to compile reference regex to DFA:', err);
    return null;
  }
}

/**
 * Tests string membership in a DFA.
 */
export function isStringAccepted(dfa, str) {
  if (!dfa) return false;
  let curr = dfa.startState;
  for (const char of str) {
    if (!dfa.alphabet.includes(char)) return false;
    const next = dfa.transitions[curr]?.[char];
    if (!next) return false;
    curr = next;
  }
  return dfa.acceptStates.includes(curr);
}

/**
 * Enumerates all strings up to maxLength over alphabet.
 */
function enumerateStrings(alphabet, maxLen = 4) {
  const result = [''];
  let currentLayer = [''];

  for (let len = 1; len <= maxLen; len++) {
    const nextLayer = [];
    currentLayer.forEach(pref => {
      alphabet.forEach(sym => {
        nextLayer.push(pref + sym);
      });
    });
    result.push(...nextLayer);
    currentLayer = nextLayer;
  }

  return result;
}

/**
 * Generates random strings over alphabet.
 */
function generateRandomStrings(alphabet, count, minLen = 2, maxLen = 8) {
  const result = new Set();
  const range = maxLen - minLen + 1;
  let attempts = 0;

  while (result.size < count && attempts < count * 20) {
    attempts++;
    const len = minLen + Math.floor(Math.random() * range);
    let s = '';
    for (let i = 0; i < len; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    result.add(s);
  }

  return [...result];
}

/**
 * Generates training and testing dataset from reference DFA.
 * @param {Object} options
 * @param {Object} options.referenceDFA - compiled reference DFA
 * @param {Array<string>} options.alphabet - alphabet symbols
 * @param {number} options.trainCount - total training samples
 * @param {number} options.testCount - total testing samples
 * @param {number} options.maxStringLength - maximum string length
 * @param {number} options.noiseRate - fraction of labels to randomly flip (0.0 to 0.3)
 * @param {string} options.diversity - 'balanced' | 'short_only' | 'diverse'
 */
export function generateDataset({
  referenceDFA,
  alphabet = ['a', 'b'],
  trainCount = 20,
  testCount = 40,
  maxStringLength = 6,
  noiseRate = 0.0,
  diversity = 'balanced',
}) {
  if (!referenceDFA) return { training: [], testing: [], positives: [], negatives: [] };

  // 1. Generate candidate pool
  const maxEnumLen = diversity === 'short_only' ? Math.min(3, maxStringLength) : Math.min(4, maxStringLength);
  const exhaustive = enumerateStrings(alphabet, maxEnumLen);
  const randomCount = diversity === 'short_only' ? 20 : 150;
  const randoms = generateRandomStrings(alphabet, randomCount, 2, maxStringLength);
  const allCandidates = [...new Set([...exhaustive, ...randoms])];

  // 2. Classify candidates using reference DFA
  const positivePool = [];
  const negativePool = [];

  allCandidates.forEach(str => {
    if (isStringAccepted(referenceDFA, str)) {
      positivePool.push(str);
    } else {
      negativePool.push(str);
    }
  });

  // Shuffle arrays
  const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
  const shuffledPos = shuffle(positivePool);
  const shuffledNeg = shuffle(negativePool);

  // 3. Sample training set
  const halfTrain = Math.floor(trainCount / 2);
  const targetPosCount = Math.min(shuffledPos.length, halfTrain);
  const targetNegCount = Math.min(shuffledNeg.length, trainCount - targetPosCount);

  const trainPosStrings = shuffledPos.slice(0, targetPosCount);
  const trainNegStrings = shuffledNeg.slice(0, targetNegCount);

  // Form training items with ground truth
  const trainItems = [
    ...trainPosStrings.map(str => ({ string: str, label: true, trueLabel: true, isNoisy: false })),
    ...trainNegStrings.map(str => ({ string: str, label: false, trueLabel: false, isNoisy: false })),
  ];

  // 4. Inject noise into training set
  if (noiseRate > 0) {
    trainItems.forEach(item => {
      if (Math.random() < noiseRate) {
        item.label = !item.label; // Flip label!
        item.isNoisy = true;
      }
    });
  }

  // Shuffle training items
  const finalTraining = shuffle(trainItems);

  // 5. Sample held-out test set (distinct from training if possible)
  const trainSetStrings = new Set(trainItems.map(t => t.string));
  const remainingPos = shuffledPos.slice(targetPosCount).filter(s => !trainSetStrings.has(s));
  const remainingNeg = shuffledNeg.slice(targetNegCount).filter(s => !trainSetStrings.has(s));

  // If not enough remaining, generate more fresh test strings
  const freshRandoms = generateRandomStrings(alphabet, testCount * 2, 1, maxStringLength + 2);
  freshRandoms.forEach(s => {
    if (!trainSetStrings.has(s)) {
      if (isStringAccepted(referenceDFA, s)) remainingPos.push(s);
      else remainingNeg.push(s);
    }
  });

  const halfTest = Math.floor(testCount / 2);
  const testPos = remainingPos.slice(0, halfTest);
  const testNeg = remainingNeg.slice(0, testCount - testPos.length);

  const finalTesting = shuffle([
    ...testPos.map(str => ({ string: str, label: true, trueLabel: true, isNoisy: false })),
    ...testNeg.map(str => ({ string: str, label: false, trueLabel: false, isNoisy: false })),
  ]);

  // Positives & Negatives for RPNI (uses the training labels, which may be noisy)
  const positives = finalTraining.filter(t => t.label).map(t => t.string);
  const negatives = finalTraining.filter(t => !t.label).map(t => t.string);

  return {
    training: finalTraining,
    testing: finalTesting,
    positives,
    negatives,
  };
}
