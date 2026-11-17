import { useState, useMemo } from 'react';
import { LANGUAGE_PRESETS } from '../utils/datasetGenerator.js';

const V = (name) => `var(${name})`;

export default function DatasetManager({
  selectedPresetId,
  onSelectPreset,
  customRegex,
  onChangeCustomRegex,
  useCustomRegex,
  onToggleUseCustomRegex,
  alphabet,
  onChangeAlphabet,
  trainCount,
  onChangeTrainCount,
  maxLen,
  onChangeMaxLen,
  noiseRate,
  onChangeNoiseRate,
  diversity,
  onChangeDiversity,
  onGenerateDataset,
  onRunRPNI,
  trainingData,
  onAddTrainingExample,
  onRemoveTrainingExample,
  onClearTrainingData,
  testingData,
  isLearning,
}) {
  const [activeTab, setActiveTab] = useState('training'); // 'training' | 'testing'
  const [newString, setNewString] = useState('');
  const [newLabel, setNewLabel] = useState(true); // true = + (Accept), false = - (Reject)

  const posCount = useMemo(() => trainingData.filter(t => t.label).length, [trainingData]);
  const negCount = useMemo(() => trainingData.filter(t => !t.label).length, [trainingData]);
  const noisyCount = useMemo(() => trainingData.filter(t => t.isNoisy).length, [trainingData]);

  const handleAddManual = (e) => {
    e.preventDefault();
    const str = newString.trim();
    // Validate string against alphabet
    const invalidChar = str.split('').find(ch => !alphabet.includes(ch));
    if (invalidChar) {
      alert(`Character '${invalidChar}' is not in the configured alphabet {${alphabet.join(', ')}}`);
      return;
    }
    onAddTrainingExample(str, newLabel);
    setNewString('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* ── Reference Language Section ── */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${V('--border-subtle')}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', fontFamily: V('--font-mono'), color: V('--text-muted')
          }}>
            1. Target Language
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: V('--text-secondary') }}>
            <input
              type="checkbox"
              checked={useCustomRegex}
              onChange={(e) => onToggleUseCustomRegex(e.target.checked)}
              style={{ accentColor: V('--neon-cyan') }}
            />
            Custom Regex
          </label>
        </div>

        {!useCustomRegex ? (
          <div>
            <select
              value={selectedPresetId}
              onChange={(e) => onSelectPreset(e.target.value)}
              style={{
                width: '100%',
                background: V('--bg-elevated'),
                border: `1px solid ${V('--border')}`,
                borderRadius: 6,
                padding: '7px 10px',
                color: V('--text-primary'),
                fontSize: 13,
                fontFamily: V('--font-body'),
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {LANGUAGE_PRESETS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.regex})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={customRegex}
              onChange={(e) => onChangeCustomRegex(e.target.value)}
              placeholder="e.g. (a|b)*abb or a+b+"
              style={{
                width: '100%',
                background: V('--bg-elevated'),
                border: `1px solid ${V('--border')}`,
                borderRadius: 6,
                padding: '7px 10px',
                color: V('--neon-cyan'),
                fontFamily: V('--font-mono'),
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Alphabet configuration */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: V('--text-muted'), fontFamily: V('--font-mono') }}>Alphabet Σ:</span>
          <input
            type="text"
            value={alphabet.join(', ')}
            onChange={(e) => {
              const syms = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              if (syms.length > 0) onChangeAlphabet(syms);
            }}
            placeholder="a, b"
            style={{
              width: 90,
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border')}`,
              borderRadius: 4,
              padding: '3px 8px',
              color: V('--text-primary'),
              fontFamily: V('--font-mono'),
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Dataset Generator Controls ── */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${V('--border-subtle')}`, background: 'rgba(0,0,0,0.1)' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: V('--font-mono'), color: V('--text-muted'),
          marginBottom: 10,
        }}>
          2. Dataset Parameters
        </div>

        {/* Training Size Slider */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: V('--text-secondary') }}>Sample Size (N)</span>
            <span style={{ fontFamily: V('--font-mono'), color: V('--neon-cyan'), fontWeight: 600 }}>{trainCount}</span>
          </div>
          <input
            type="range"
            min="6"
            max="80"
            step="2"
            value={trainCount}
            onChange={(e) => onChangeTrainCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: V('--neon-cyan') }}
          />
        </div>

        {/* Max String Length */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: V('--text-secondary') }}>Max Length</span>
            <span style={{ fontFamily: V('--font-mono'), color: V('--neon-cyan'), fontWeight: 600 }}>{maxLen}</span>
          </div>
          <input
            type="range"
            min="3"
            max="10"
            value={maxLen}
            onChange={(e) => onChangeMaxLen(Number(e.target.value))}
            style={{ width: '100%', accentColor: V('--neon-cyan') }}
          />
        </div>

        {/* Noise Rate Slider */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: V('--text-secondary') }}>Label Noise Rate</span>
            <span style={{
              fontFamily: V('--font-mono'),
              color: noiseRate > 0 ? V('--neon-amber') : V('--text-muted'),
              fontWeight: 600,
            }}>
              {Math.round(noiseRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.30"
            step="0.05"
            value={noiseRate}
            onChange={(e) => onChangeNoiseRate(Number(e.target.value))}
            style={{ width: '100%', accentColor: noiseRate > 0 ? V('--neon-amber') : V('--neon-cyan') }}
          />
        </div>

        {/* Diversity selector */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: V('--text-secondary') }}>Diversity</span>
          <select
            value={diversity}
            onChange={(e) => onChangeDiversity(e.target.value)}
            style={{
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border')}`,
              borderRadius: 4,
              padding: '3px 8px',
              color: V('--text-primary'),
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="balanced">Balanced Lengths</option>
            <option value="short_only">Short Strings Only</option>
            <option value="diverse">High Variance (Deep)</option>
          </select>
        </div>

        {/* Generate & Learn Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onGenerateDataset}
            style={{
              flex: 1,
              background: V('--bg-elevated'),
              border: `1px solid ${V('--border')}`,
              borderRadius: 6,
              padding: '7px 10px',
              color: V('--text-primary'),
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background 0.15s ease',
            }}
          >
            🎲 Generate
          </button>

          <button
            onClick={onRunRPNI}
            disabled={trainingData.length === 0 || isLearning}
            style={{
              flex: 1.3,
              background: 'linear-gradient(135deg, #00f0ff 0%, #00b0ff 100%)',
              border: 'none',
              borderRadius: 6,
              padding: '7px 10px',
              color: '#000',
              fontSize: 12,
              fontWeight: 700,
              cursor: trainingData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: trainingData.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,240,255,0.25)',
            }}
          >
            ⚡ {isLearning ? 'Learning...' : 'Infer DFA'}
          </button>
        </div>
      </div>

      {/* ── Data Inspector & Manual Input ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Subtabs: Training vs Test */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${V('--border-subtle')}`,
          background: V('--bg-surface'),
        }}>
          <button
            onClick={() => setActiveTab('training')}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: V('--font-mono'),
              fontWeight: 600,
              color: activeTab === 'training' ? V('--neon-cyan') : V('--text-muted'),
              borderBottom: activeTab === 'training' ? `2px solid ${V('--neon-cyan')}` : '2px solid transparent',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Training ({trainingData.length})
          </button>
          <button
            onClick={() => setActiveTab('testing')}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: V('--font-mono'),
              fontWeight: 600,
              color: activeTab === 'testing' ? V('--neon-cyan') : V('--text-muted'),
              borderBottom: activeTab === 'testing' ? `2px solid ${V('--neon-cyan')}` : '2px solid transparent',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Test Set ({testingData.length})
          </button>
        </div>

        {/* Dataset Summary Pills */}
        {activeTab === 'training' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: `1px solid ${V('--border-subtle')}`,
            fontSize: 11,
            fontFamily: V('--font-mono'),
          }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: V('--neon-green') }}>+ {posCount} Pos</span>
              <span style={{ color: V('--error') }}>- {negCount} Neg</span>
              {noisyCount > 0 && <span style={{ color: V('--neon-amber') }}>⚠ {noisyCount} Noisy</span>}
            </div>
            {trainingData.length > 0 && (
              <button
                onClick={onClearTrainingData}
                style={{
                  background: 'none',
                  border: 'none',
                  color: V('--text-muted'),
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Manual String Entry Bar (Training Tab only) */}
        {activeTab === 'training' && (
          <form onSubmit={handleAddManual} style={{ padding: '8px 16px', borderBottom: `1px solid ${V('--border-subtle')}` }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={newString}
                onChange={(e) => setNewString(e.target.value)}
                placeholder='Enter string (e.g. "abb", "" for ε)'
                style={{
                  flex: 1,
                  background: V('--bg-elevated'),
                  border: `1px solid ${V('--border')}`,
                  borderRadius: 4,
                  padding: '5px 8px',
                  color: V('--text-primary'),
                  fontFamily: V('--font-mono'),
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setNewLabel(l => !l)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 11,
                  fontFamily: V('--font-mono'),
                  cursor: 'pointer',
                  background: newLabel ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 85, 85, 0.2)',
                  color: newLabel ? V('--neon-green') : V('--error'),
                }}
              >
                {newLabel ? '+ Accept' : '- Reject'}
              </button>
              <button
                type="submit"
                style={{
                  padding: '5px 10px',
                  background: V('--bg-elevated'),
                  border: `1px solid ${V('--border')}`,
                  borderRadius: 4,
                  color: V('--text-primary'),
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add
              </button>
            </div>
          </form>
        )}

        {/* String List Viewer */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
          {activeTab === 'training' ? (
            trainingData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: V('--text-muted'), fontSize: 12 }}>
                No training strings yet. Click "Generate" or add examples manually.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {trainingData.map((item, idx) => (
                  <div
                    key={`${item.string}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: V('--bg-surface'),
                      border: `1px solid ${item.isNoisy ? 'rgba(255,184,0,0.3)' : V('--border-subtle')}`,
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: V('--font-mono'),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 700,
                          background: item.label ? 'rgba(0,255,136,0.15)' : 'rgba(255,85,85,0.15)',
                          color: item.label ? V('--neon-green') : V('--error'),
                        }}
                      >
                        {item.label ? '+ POS' : '- NEG'}
                      </span>
                      <span style={{ color: V('--text-primary'), fontWeight: 600 }}>
                        {item.string === '' ? 'ε (empty)' : `"${item.string}"`}
                      </span>
                      {item.isNoisy && (
                        <span style={{
                          fontSize: 9, padding: '1px 4px', borderRadius: 3,
                          background: 'rgba(255,184,0,0.2)', color: V('--neon-amber'), fontWeight: 700
                        }}>
                          NOISY
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onRemoveTrainingExample(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: V('--text-muted'),
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: '0 4px',
                      }}
                      title="Remove example"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            testingData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: V('--text-muted'), fontSize: 12 }}>
                No test strings. Generate a dataset to evaluate generalization.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {testingData.map((item, idx) => (
                  <div
                    key={`test-${item.string}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: V('--bg-surface'),
                      border: `1px solid ${V('--border-subtle')}`,
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: V('--font-mono'),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 700,
                          background: item.label ? 'rgba(0,255,136,0.15)' : 'rgba(255,85,85,0.15)',
                          color: item.label ? V('--neon-green') : V('--error'),
                        }}
                      >
                        {item.label ? '+ POS' : '- NEG'}
                      </span>
                      <span style={{ color: V('--text-primary') }}>
                        {item.string === '' ? 'ε (empty)' : `"${item.string}"`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
