import { useState } from 'react';
import { runQuantityExperiment, runNoiseExperiment } from '../utils/evaluation.js';

const V = (name) => `var(${name})`;

export default function EvaluationPanel({
  evaluation = null,
  equivalence = null,
  referenceDFA = null,
  inferredDFA = null,
  alphabet = ['a', 'b'],
  onAddCounterexample = null,
}) {
  const [subTab, setSubTab] = useState('metrics'); // 'metrics' | 'experiments'
  const [quantityResults, setQuantityResults] = useState(null);
  const [noiseResults, setNoiseResults] = useState(null);
  const [isRunningExp, setIsRunningExp] = useState(false);

  const handleRunQuantity = () => {
    if (!referenceDFA) return;
    setIsRunningExp(true);
    setTimeout(() => {
      const res = runQuantityExperiment(referenceDFA, alphabet, [6, 12, 24, 48, 80]);
      setQuantityResults(res);
      setIsRunningExp(false);
    }, 100);
  };

  const handleRunNoise = () => {
    if (!referenceDFA) return;
    setIsRunningExp(true);
    setTimeout(() => {
      const res = runNoiseExperiment(referenceDFA, alphabet, 30, [0.0, 0.05, 0.10, 0.20, 0.30]);
      setNoiseResults(res);
      setIsRunningExp(false);
    }, 100);
  };

  if (!inferredDFA) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 180, color: V('--text-muted'), gap: 8
      }}>
        <span style={{ fontSize: 32, opacity: 0.5 }}>📊</span>
        <p style={{ fontSize: 13, fontFamily: V('--font-mono') }}>
          Train an automaton to view evaluation & metrics
        </p>
      </div>
    );
  }

  const { accuracy = 0, precision = 0, recall = 0, f1 = 0, tp = 0, fp = 0, tn = 0, fn = 0, details = [] } = evaluation || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* ── Subtabs ── */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${V('--border-subtle')}`,
        background: V('--bg-surface')
      }}>
        <button
          onClick={() => setSubTab('metrics')}
          style={{
            flex: 1, padding: '9px 12px', fontSize: 12, fontFamily: V('--font-mono'),
            fontWeight: 600, color: subTab === 'metrics' ? V('--neon-cyan') : V('--text-muted'),
            borderBottom: subTab === 'metrics' ? `2px solid ${V('--neon-cyan')}` : '2px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Generalization & Metrics
        </button>
        <button
          onClick={() => setSubTab('experiments')}
          style={{
            flex: 1, padding: '9px 12px', fontSize: 12, fontFamily: V('--font-mono'),
            fontWeight: 600, color: subTab === 'experiments' ? V('--neon-cyan') : V('--text-muted'),
            borderBottom: subTab === 'experiments' ? `2px solid ${V('--neon-cyan')}` : '2px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Empirical Studies
        </button>
      </div>

      {subTab === 'metrics' ? (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Metric Cards Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div style={{
              background: V('--bg-elevated'), padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${V('--border-subtle')}`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 10, color: V('--text-muted'), fontFamily: V('--font-mono'), textTransform: 'uppercase' }}>
                Accuracy
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V('--font-mono'), color: V('--neon-cyan'), marginTop: 2 }}>
                {accuracy}%
              </div>
            </div>

            <div style={{
              background: V('--bg-elevated'), padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${V('--border-subtle')}`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 10, color: V('--text-muted'), fontFamily: V('--font-mono'), textTransform: 'uppercase' }}>
                Precision
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V('--font-mono'), color: V('--neon-green'), marginTop: 2 }}>
                {precision}%
              </div>
            </div>

            <div style={{
              background: V('--bg-elevated'), padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${V('--border-subtle')}`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 10, color: V('--text-muted'), fontFamily: V('--font-mono'), textTransform: 'uppercase' }}>
                Recall
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V('--font-mono'), color: V('--neon-purple'), marginTop: 2 }}>
                {recall}%
              </div>
            </div>

            <div style={{
              background: V('--bg-elevated'), padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${V('--border-subtle')}`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 10, color: V('--text-muted'), fontFamily: V('--font-mono'), textTransform: 'uppercase' }}>
                F1 Score
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V('--font-mono'), color: V('--neon-amber'), marginTop: 2 }}>
                {f1}%
              </div>
            </div>
          </div>

          {/* ── Equivalence Card & Active Learning Oracle ── */}
          {equivalence && (
            <div style={{
              padding: '12px 14px', borderRadius: 6,
              background: equivalence.equivalent ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 184, 0, 0.08)',
              border: `1px solid ${equivalence.equivalent ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 184, 0, 0.3)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: V('--font-mono'),
                  color: equivalence.equivalent ? V('--neon-green') : V('--neon-amber')
                }}>
                  {equivalence.equivalent
                    ? '✓ Language Equivalent L(M) ≡ L(Reference)'
                    : '✗ Incomplete / Discrepancy Found'}
                </span>
              </div>

              {equivalence.equivalent ? (
                <div style={{ fontSize: 12, color: V('--text-secondary') }}>
                  The learned DFA perfectly recognizes the target regular language with 0 counterexamples.
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: V('--text-primary'), marginBottom: 6 }}>
                    Shortest counterexample: <code style={{
                      fontFamily: V('--font-mono'), background: V('--bg-base'),
                      padding: '2px 6px', borderRadius: 4, color: V('--neon-cyan')
                    }}>
                      {equivalence.counterexample}
                    </code>
                  </div>
                  <div style={{ fontSize: 11, color: V('--text-muted'), marginBottom: 8 }}>
                    Reference expects: <strong style={{ color: equivalence.referenceAccepts ? V('--neon-green') : V('--error') }}>
                      {equivalence.referenceAccepts ? 'Accept (+)' : 'Reject (-)'}
                    </strong>
                    {' '}| Inferred predicted: <strong style={{ color: equivalence.inferredAccepts ? V('--neon-green') : V('--error') }}>
                      {equivalence.inferredAccepts ? 'Accept (+)' : 'Reject (-)'}
                    </strong>
                  </div>

                  {onAddCounterexample && (
                    <button
                      onClick={() => onAddCounterexample(equivalence.rawString, equivalence.referenceAccepts)}
                      style={{
                        background: 'rgba(255, 184, 0, 0.2)',
                        border: '1px solid rgba(255, 184, 0, 0.4)',
                        color: V('--neon-amber'),
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontFamily: V('--font-mono'),
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      💡 Active Learning: Query Oracle & Retrain
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Confusion Matrix ── */}
          <div style={{ background: V('--bg-surface'), padding: '12px 14px', borderRadius: 6, border: `1px solid ${V('--border-subtle')}` }}>
            <div style={{
              fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
              textTransform: 'uppercase', letterSpacing: '0.08em', color: V('--text-muted'),
              marginBottom: 8,
            }}>
              Confusion Matrix (Test Set)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6, fontSize: 11, fontFamily: V('--font-mono'), textAlign: 'center' }}>
              <div></div>
              <div style={{ color: V('--text-muted') }}>Pred Positive</div>
              <div style={{ color: V('--text-muted') }}>Pred Negative</div>

              <div style={{ textAlign: 'left', color: V('--text-muted') }}>Actual Pos</div>
              <div style={{ background: 'rgba(0, 255, 136, 0.1)', color: V('--neon-green'), padding: '6px', borderRadius: 4, fontWeight: 700 }}>
                TP: {tp}
              </div>
              <div style={{ background: 'rgba(255, 85, 85, 0.1)', color: V('--error'), padding: '6px', borderRadius: 4, fontWeight: 700 }}>
                FN: {fn}
              </div>

              <div style={{ textAlign: 'left', color: V('--text-muted') }}>Actual Neg</div>
              <div style={{ background: 'rgba(255, 85, 85, 0.1)', color: V('--error'), padding: '6px', borderRadius: 4, fontWeight: 700 }}>
                FP: {fp}
              </div>
              <div style={{ background: 'rgba(0, 255, 136, 0.1)', color: V('--neon-green'), padding: '6px', borderRadius: 4, fontWeight: 700 }}>
                TN: {tn}
              </div>
            </div>
          </div>

          {/* ── Detailed Test Predictions Sample ── */}
          {details.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
                textTransform: 'uppercase', letterSpacing: '0.08em', color: V('--text-muted'),
                marginBottom: 6,
              }}>
                Test Set Sample Predictions ({details.length})
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {details.slice(0, 25).map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderRadius: 4,
                      background: d.isCorrect ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 85, 85, 0.08)',
                      border: `1px solid ${d.isCorrect ? 'transparent' : 'rgba(255,85,85,0.2)'}`,
                      fontSize: 11, fontFamily: V('--font-mono'),
                    }}
                  >
                    <span style={{ color: V('--text-primary'), fontWeight: 600 }}>
                      "{d.displayString}"
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: V('--text-muted') }}>
                        Actual: {d.actual ? '+POS' : '-NEG'}
                      </span>
                      <span style={{ color: d.isCorrect ? V('--neon-green') : V('--error'), fontWeight: 700 }}>
                        {d.isCorrect ? '✓ Match' : '✗ Misclassified'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Empirical Experiments Tab ── */
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Study 1: Quantity */}
          <div style={{
            background: V('--bg-surface'), padding: '12px 14px', borderRadius: 6,
            border: `1px solid ${V('--border-subtle')}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: V('--text-primary') }}>
                  Study 1: Effect of Training Quantity
                </div>
                <div style={{ fontSize: 11, color: V('--text-muted') }}>
                  Measures how test accuracy scales with sample size N
                </div>
              </div>
              <button
                onClick={handleRunQuantity}
                disabled={isRunningExp}
                style={{
                  background: V('--neon-blue'), border: 'none', borderRadius: 4,
                  padding: '5px 10px', color: '#fff', fontSize: 11,
                  fontFamily: V('--font-mono'), fontWeight: 600, cursor: 'pointer',
                  opacity: isRunningExp ? 0.5 : 1,
                }}
              >
                {isRunningExp ? 'Running...' : 'Run Study'}
              </button>
            </div>

            {quantityResults && (
              <div style={{ marginTop: 10 }}>
                <table style={{ width: '100%', fontSize: 11, fontFamily: V('--font-mono'), borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: V('--text-muted'), borderBottom: `1px solid ${V('--border-subtle')}`, textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>N</th>
                      <th style={{ padding: '4px 6px' }}>Test Acc</th>
                      <th style={{ padding: '4px 6px' }}>States |Q|</th>
                      <th style={{ padding: '4px 6px' }}>Equivalence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quantityResults.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${V('--border-subtle')}` }}>
                        <td style={{ padding: '6px', color: V('--neon-cyan'), fontWeight: 600 }}>{row.trainSize}</td>
                        <td style={{ padding: '6px', color: row.testAcc >= 90 ? V('--neon-green') : V('--neon-amber') }}>
                          {row.testAcc}%
                        </td>
                        <td style={{ padding: '6px', color: V('--text-primary') }}>{row.stateCount}</td>
                        <td style={{ padding: '6px', color: row.equivalent ? V('--neon-green') : V('--text-muted') }}>
                          {row.equivalent ? '✓ Exact' : 'Approx'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Study 2: Noise Impact */}
          <div style={{
            background: V('--bg-surface'), padding: '12px 14px', borderRadius: 6,
            border: `1px solid ${V('--border-subtle')}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: V('--text-primary') }}>
                  Study 2: Effect of Label Noise
                </div>
                <div style={{ fontSize: 11, color: V('--text-muted') }}>
                  Measures robustness as mislabeled noise increases (0% to 30%)
                </div>
              </div>
              <button
                onClick={handleRunNoise}
                disabled={isRunningExp}
                style={{
                  background: V('--neon-blue'), border: 'none', borderRadius: 4,
                  padding: '5px 10px', color: '#fff', fontSize: 11,
                  fontFamily: V('--font-mono'), fontWeight: 600, cursor: 'pointer',
                  opacity: isRunningExp ? 0.5 : 1,
                }}
              >
                {isRunningExp ? 'Running...' : 'Run Study'}
              </button>
            </div>

            {noiseResults && (
              <div style={{ marginTop: 10 }}>
                <table style={{ width: '100%', fontSize: 11, fontFamily: V('--font-mono'), borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: V('--text-muted'), borderBottom: `1px solid ${V('--border-subtle')}`, textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>Noise</th>
                      <th style={{ padding: '4px 6px' }}>Test Acc</th>
                      <th style={{ padding: '4px 6px' }}>States |Q|</th>
                      <th style={{ padding: '4px 6px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noiseResults.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${V('--border-subtle')}` }}>
                        <td style={{ padding: '6px', color: row.noiseRate > 0 ? V('--neon-amber') : V('--text-muted'), fontWeight: 600 }}>
                          {row.noiseLevel}
                        </td>
                        <td style={{ padding: '6px', color: row.testAcc >= 85 ? V('--neon-green') : V('--error') }}>
                          {row.testAcc}%
                        </td>
                        <td style={{ padding: '6px', color: V('--text-primary') }}>{row.stateCount}</td>
                        <td style={{ padding: '6px', color: row.equivalent ? V('--neon-green') : V('--text-muted') }}>
                          {row.equivalent ? '✓ Exact' : 'Degraded'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
