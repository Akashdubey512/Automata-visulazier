/**
 * Automata Model Evaluation & Empirical Experiments
 * Measures accuracy, generalization, confusion matrix, and runs empirical studies.
 */

import { isStringAccepted, generateDataset } from './datasetGenerator.js';
import { rpni } from './rpni.js';
import { checkDfaEquivalence } from './automataEquivalence.js';

/**
 * Evaluates a DFA on a dataset of labeled strings.
 */
export function evaluateDfa(dfa, dataset) {
  if (!dfa || !dataset || dataset.length === 0) {
    return {
      total: 0,
      tp: 0,
      fp: 0,
      tn: 0,
      fn: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      details: [],
    };
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  const details = dataset.map(item => {
    const predicted = isStringAccepted(dfa, item.string);
    // Prefer trueLabel if available (ground truth), otherwise label
    const actual = item.trueLabel !== undefined ? item.trueLabel : item.label;

    if (actual && predicted) tp++;
    else if (!actual && predicted) fp++;
    else if (!actual && !predicted) tn++;
    else if (actual && !predicted) fn++;

    return {
      string: item.string,
      displayString: item.string === '' ? 'ε' : item.string,
      actual,
      predicted,
      isCorrect: actual === predicted,
      isNoisy: !!item.isNoisy,
    };
  });

  const total = dataset.length;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    total,
    tp,
    fp,
    tn,
    fn,
    accuracy: Math.round(accuracy * 1000) / 10, // e.g. 95.5%
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1: Math.round(f1 * 1000) / 10,
    details,
  };
}

/**
 * Empirical Experiment 1: Effect of Training Quantity on Generalization
 */
export function runQuantityExperiment(referenceDFA, alphabet, sizes = [6, 12, 24, 48, 80]) {
  if (!referenceDFA) return [];

  // Generate a large fixed test set for fair evaluation
  const testData = generateDataset({
    referenceDFA,
    alphabet,
    trainCount: 10,
    testCount: 100,
    maxStringLength: 7,
    noiseRate: 0,
  }).testing;

  return sizes.map(size => {
    const { positives, negatives, training } = generateDataset({
      referenceDFA,
      alphabet,
      trainCount: size,
      testCount: 10,
      maxStringLength: 6,
      noiseRate: 0,
    });

    const { inferredDFA } = rpni(positives, negatives, alphabet);
    const trainEval = evaluateDfa(inferredDFA, training);
    const testEval = evaluateDfa(inferredDFA, testData);
    const equiv = checkDfaEquivalence(inferredDFA, referenceDFA, alphabet);

    return {
      trainSize: size,
      trainAcc: trainEval.accuracy,
      testAcc: testEval.accuracy,
      stateCount: inferredDFA.states.length,
      equivalent: equiv.equivalent,
      counterexample: equiv.counterexample,
    };
  });
}

/**
 * Empirical Experiment 2: Effect of Label Noise on Inferred Machine
 */
export function runNoiseExperiment(referenceDFA, alphabet, sampleSize = 30, noiseLevels = [0.0, 0.05, 0.10, 0.20, 0.30]) {
  if (!referenceDFA) return [];

  const testData = generateDataset({
    referenceDFA,
    alphabet,
    trainCount: 10,
    testCount: 100,
    maxStringLength: 7,
    noiseRate: 0,
  }).testing;

  return noiseLevels.map(noiseRate => {
    const { positives, negatives } = generateDataset({
      referenceDFA,
      alphabet,
      trainCount: sampleSize,
      testCount: 10,
      maxStringLength: 6,
      noiseRate,
    });

    const { inferredDFA } = rpni(positives, negatives, alphabet);
    const testEval = evaluateDfa(inferredDFA, testData);
    const equiv = checkDfaEquivalence(inferredDFA, referenceDFA, alphabet);

    return {
      noiseLevel: `${Math.round(noiseRate * 100)}%`,
      noiseRate,
      testAcc: testEval.accuracy,
      stateCount: inferredDFA.states.length,
      equivalent: equiv.equivalent,
      counterexample: equiv.counterexample,
    };
  });
}
