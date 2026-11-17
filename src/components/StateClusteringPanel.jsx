import { useMemo } from 'react';
import { clusterDfaStates } from '../utils/stateClustering.js';

const V = (name) => `var(${name})`;

export default function StateClusteringPanel({ dfa = null, k = 2 }) {
  const clustering = useMemo(() => {
    if (!dfa) return null;
    return clusterDfaStates(dfa, k);
  }, [dfa, k]);

  if (!dfa || !clustering) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 180, color: V('--text-muted'), gap: 8
      }}>
        <span style={{ fontSize: 32, opacity: 0.5 }}>🔮</span>
        <p style={{ fontSize: 13, fontFamily: V('--font-mono') }}>
          Select or learn a DFA to view state clustering
        </p>
      </div>
    );
  }

  const { clusters = [] } = clustering;

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
          textTransform: 'uppercase', letterSpacing: '0.08em', color: V('--text-muted'),
          marginBottom: 4,
        }}>
          Exploratory State Clustering (k = {k})
        </div>
        <div style={{ fontSize: 12, color: V('--text-secondary'), lineHeight: 1.4 }}>
          States are clustered by their future acceptance signature over short suffixes Σ<sup>≤{k}</sup>.
          States in the same cluster exhibit identical future language continuations.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {clusters.map((c, i) => (
          <div
            key={i}
            style={{
              background: V('--bg-surface'),
              border: `1px solid ${c.isAcceptingCluster ? 'rgba(0, 255, 136, 0.25)' : V('--border-subtle')}`,
              borderRadius: 6,
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: V('--font-mono'),
                  color: V('--neon-cyan')
                }}>
                  {c.id}
                </span>
                <span style={{
                  fontSize: 10, fontFamily: V('--font-mono'), padding: '1px 6px',
                  borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: V('--text-secondary')
                }}>
                  {c.size} state{c.size > 1 ? 's' : ''}
                </span>
              </div>

              {c.isAcceptingCluster && (
                <span style={{
                  fontSize: 10, fontFamily: V('--font-mono'), fontWeight: 700,
                  color: V('--neon-green'), background: 'rgba(0,255,136,0.1)',
                  padding: '1px 6px', borderRadius: 3
                }}>
                  ACCEPTING
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {c.states.map(s => (
                <span
                  key={s}
                  style={{
                    fontFamily: V('--font-mono'), fontSize: 12, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4,
                    background: V('--bg-elevated'), color: V('--text-primary'),
                    border: `1px solid ${V('--border')}`
                  }}
                >
                  {s}
                </span>
              ))}
            </div>

            <div style={{ fontSize: 11, color: V('--text-muted'), fontFamily: V('--font-mono') }}>
              Accepted Suffixes: <span style={{ color: V('--text-primary') }}>{c.acceptedSuffixes.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
