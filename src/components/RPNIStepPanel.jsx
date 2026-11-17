import { useRef, useEffect } from 'react';

const V = (name) => `var(${name})`;

export default function RPNIStepPanel({ steps = [], currentStep = -1, onStepChange }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current && currentStep >= 0) {
      const el = listRef.current.children[currentStep];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  if (!steps || steps.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 180, color: V('--text-muted'), gap: 8
      }}>
        <span style={{ fontSize: 32, opacity: 0.5 }}>⚡</span>
        <p style={{ fontSize: 13, fontFamily: V('--font-mono') }}>
          Run RPNI inference to inspect learning steps
        </p>
      </div>
    );
  }

  const progress = currentStep >= 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${V('--border-subtle')}`, background: V('--bg-surface') }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: V('--font-mono'),
            textTransform: 'uppercase', letterSpacing: '0.08em', color: V('--text-muted')
          }}>
            RPNI State-Merging Steps
          </span>
          <span style={{ fontSize: 13, fontFamily: V('--font-mono'), color: V('--text-primary') }}>
            {currentStep >= 0 ? currentStep + 1 : 0}
            <span style={{ color: V('--text-muted') }}>/{steps.length}</span>
          </span>
        </div>
        <div style={{ height: 4, background: V('--bg-overlay'), borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #00f0ff, #6e56cf)',
              width: `${progress}%`,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 16px',
        borderBottom: `1px solid ${V('--border-subtle')}`, background: V('--bg-surface')
      }}>
        <button
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep <= 0}
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12, fontFamily: V('--font-mono'),
            fontWeight: 600, background: V('--bg-elevated'), border: `1px solid ${V('--border')}`,
            borderRadius: 4, color: V('--text-primary'), cursor: currentStep <= 0 ? 'not-allowed' : 'pointer',
            opacity: currentStep <= 0 ? 0.4 : 1,
          }}
        >
          ← Prev
        </button>
        <button
          onClick={() => onStepChange(currentStep === -1 ? 0 : Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep >= steps.length - 1}
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12, fontFamily: V('--font-mono'),
            fontWeight: 600, background: V('--neon-blue'), border: 'none',
            borderRadius: 4, color: '#fff', cursor: currentStep >= steps.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentStep >= steps.length - 1 ? 0.4 : 1,
          }}
        >
          Next →
        </button>
      </div>

      {/* ── Step Items ── */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((st, i) => {
            const isActive = i === currentStep;

            const isSuccess = st.action === 'MERGE_SUCCESS';
            const isFailed = st.action === 'MERGE_FAILED';

            const badgeBg = isSuccess
              ? 'rgba(0, 255, 136, 0.15)'
              : isFailed
              ? 'rgba(255, 85, 85, 0.15)'
              : 'rgba(110, 86, 207, 0.15)';

            const badgeColor = isSuccess
              ? V('--neon-green')
              : isFailed
              ? V('--error')
              : V('--neon-blue');

            const badgeLabel = isSuccess
              ? 'MERGE ACCEPTED'
              : isFailed
              ? 'MERGE REJECTED'
              : 'PROMOTED TO CORE';

            return (
              <div
                key={i}
                onClick={() => onStepChange(i)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(0, 240, 255, 0.08)' : V('--bg-surface'),
                  border: isActive ? `1px solid ${V('--neon-cyan')}` : `1px solid ${V('--border-subtle')}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: V('--font-mono'), color: V('--text-muted') }}>
                      #{st.step}
                    </span>
                    <span style={{
                      fontSize: 10, fontFamily: V('--font-mono'), fontWeight: 700,
                      padding: '1px 6px', borderRadius: 3, background: badgeBg, color: badgeColor
                    }}>
                      {badgeLabel}
                    </span>
                  </div>
                  {st.stateCount && (
                    <span style={{ fontSize: 11, fontFamily: V('--font-mono'), color: V('--text-secondary') }}>
                      |Q| = {st.stateCount}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: V('--text-primary'), marginTop: 4, lineHeight: 1.4 }}>
                  {st.explanation}
                </div>

                {st.conflictingString && (
                  <div style={{
                    marginTop: 6, fontSize: 11, fontFamily: V('--font-mono'),
                    padding: '3px 6px', background: 'rgba(255,85,85,0.1)',
                    borderRadius: 4, color: V('--error')
                  }}>
                    Conflict with S⁻: "{st.conflictingString}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
