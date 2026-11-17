/**
 * Active Learning & Oracle Assistance
 * Allows interactive query synthesis (Angluin-style Oracle) to guide automata induction.
 */

import { checkDfaEquivalence } from './automataEquivalence.js';
import { isStringAccepted } from './datasetGenerator.js';

/**
 * Queries the Oracle (Reference DFA) for an equivalence counterexample.
 * If found, returns the counterexample string and its true label.
 */
export function queryOracleForCounterexample(inferredDFA, referenceDFA, alphabet) {
  if (!inferredDFA || !referenceDFA) {
    return { hasCounterexample: false, counterexample: null, message: 'Models unavailable' };
  }

  const equiv = checkDfaEquivalence(inferredDFA, referenceDFA, alphabet);

  if (equiv.equivalent) {
    return {
      hasCounterexample: false,
      counterexample: null,
      message: 'Learned model is already 100% equivalent to the target language! No counterexamples found.',
    };
  }

  const w = equiv.rawString !== undefined ? equiv.rawString : (equiv.counterexample === 'ε (empty string)' ? '' : equiv.counterexample);
  const trueLabel = isStringAccepted(referenceDFA, w);
  const predictedLabel = isStringAccepted(inferredDFA, w);

  return {
    hasCounterexample: true,
    counterexample: w,
    displayString: w === '' ? 'ε (empty string)' : w,
    trueLabel,
    predictedLabel,
    message: `Counterexample found: string "${w === '' ? 'ε' : w}" is ${trueLabel ? 'Accepted' : 'Rejected'} by Reference, but ${predictedLabel ? 'Accepted' : 'Rejected'} by Inferred DFA.`,
  };
}
