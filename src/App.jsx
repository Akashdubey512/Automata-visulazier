import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import NFABuilder   from './components/NFABuilder';
import RegexInput   from './components/RegexInput';
import GraphView    from './components/GraphView';
import StepPanel    from './components/StepPanel';
import MinStepPanel from './components/MinStepPanel';
import StringTester from './components/StringTester';
import DatasetManager from './components/DatasetManager';
import RPNIStepPanel  from './components/RPNIStepPanel';
import EvaluationPanel from './components/EvaluationPanel';
import StateClusteringPanel from './components/StateClusteringPanel';

import { subsetConstruction, compressNFA } from './utils/nfaToDfa';
import { regexToENFA }    from './utils/regexToENFA';
import { buildMinimalNFA } from './utils/minimalNFA';
import { hopcroftMinimize } from './utils/minimizeDFA';
import { nfaToFlowData, dfaToFlowData } from './utils/graphLayout';
import { normalizeNfaAutomaton, normalizeDfaAutomaton } from './utils/automata';
import { LANGUAGE_PRESETS, buildReferenceDFA, generateDataset } from './utils/datasetGenerator';
import { rpni } from './utils/rpni';
import { checkDfaEquivalence } from './utils/automataEquivalence';
import { evaluateDfa } from './utils/evaluation';

const INITIAL_NFA = normalizeNfaAutomaton({
  states: ['q0', 'q1', 'q2'],
  alphabet: ['a', 'b'],
  startState: 'q0',
  acceptStates: ['q2'],
  transitions: {
    q0: { a: ['q0', 'q1'], b: ['q0'] },
    q1: { a: [],            b: ['q2'] },
    q2: { a: [],            b: []     },
  },
  epsilon: { q0: [], q1: [], q2: [] },
});

const SIDEBAR_WIDTH = 340;

export default function App() {
  // ── Input mode: 'learn' (Problem 8) | 'regex' | 'builder' ───────────
  const [inputMode, setInputMode] = useState('learn');

  // ── Classical Pipeline states ─────────────────────────────────────────
  const [nfa,         setNfa]         = useState(INITIAL_NFA);
  const [enfa,        setEnfa]        = useState(null);
  const [nfaClean,    setNfaClean]    = useState(null);
  const [dfa,         setDfa]         = useState(null);
  const [minDfa,      setMinDfa]      = useState(null);
  const [regexString, setRegexString] = useState('');

  // ── Problem 8 Automata Learning states ────────────────────────────────
  const [selectedPresetId, setSelectedPresetId] = useState('ends_with_abb');
  const [customRegex,      setCustomRegex]      = useState('(a|b)*abb');
  const [useCustomRegex,   setUseCustomRegex]   = useState(false);
  const [alphabet,         setAlphabet]         = useState(['a', 'b']);
  const [trainCount,       setTrainCount]       = useState(20);
  const [maxLen,           setMaxLen]           = useState(6);
  const [noiseRate,        setNoiseRate]        = useState(0.0);
  const [diversity,        setDiversity]        = useState('balanced');
  const [trainingData,     setTrainingData]     = useState([]);
  const [testingData,      setTestingData]      = useState([]);
  const [isLearning,       setIsLearning]       = useState(false);

  // Inferred automata
  const [referenceDfa,     setReferenceDfa]     = useState(null);
  const [pta,              setPta]              = useState(null);
  const [inferredDfa,      setInferredDfa]      = useState(null);
  const [minInferredDfa,   setMinInferredDfa]   = useState(null);
  const [rpniSteps,        setRpniSteps]        = useState([]);
  const [rpniStep,         setRpniStep]         = useState(-1);
  const [evaluation,       setEvaluation]       = useState(null);
  const [equivalence,      setEquivalence]      = useState(null);

  // ── Active canvas stage ──────────────────────────────────────────────
  const [activeStage, setActiveStage] = useState('inferredDfa');

  // ── Simulation state ─────────────────────────────────────────────────
  const [currentStep,      setCurrentStep]      = useState(-1);
  const [minStep,          setMinStep]          = useState(-1);
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [pathNodes,        setPathNodes]        = useState([]);
  const [traverseEdge,     setTraverseEdge]     = useState(null);
  const [simRejected,      setSimRejected]      = useState(false);
  const [isPlaying,        setIsPlaying]        = useState(false);
  const playTimerRef = useRef(null);

  // ── Right sidebar ────────────────────────────────────────────────────
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [rightTab,         setRightTab]         = useState('eval');

  // ── Sidebar collapse ─────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Ready indicators ─────────────────────────────────────────────────
  const [readyStages, setReadyStages] = useState(new Set());

  const markReady = (id) => setReadyStages(prev => new Set([...prev, id]));
  const clearReady = (id) => setReadyStages(prev => { const n = new Set(prev); n.delete(id); return n; });

  // ── Reset pipeline downstream ────────────────────────────────────────
  const resetFrom = useCallback((stage) => {
    if (stage === 'enfa') { setNfaClean(null); setDfa(null); setMinDfa(null); setCurrentStep(-1); setMinStep(-1); }
    if (stage === 'nfa')  { setDfa(null); setMinDfa(null); setCurrentStep(-1); setMinStep(-1); }
    if (stage === 'dfa')  { setMinDfa(null); setMinStep(-1); }
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
    setIsPlaying(false);
  }, []);

  // ── Classical Conversion Handlers ────────────────────────────────────
  const handleBuildFromRegex = useCallback((regex) => {
    const result = normalizeNfaAutomaton(regexToENFA(regex));
    setEnfa(result);
    setRegexString(regex);
    resetFrom('enfa');
    markReady('enfa');
    setActiveStage('enfa');
  }, [resetFrom]);

  const handleRemoveEpsilon = useCallback(() => {
    if (!regexString) return;
    const minNFA = normalizeNfaAutomaton(buildMinimalNFA(regexString));
    setNfaClean(minNFA);
    resetFrom('nfa');
    markReady('nfa');
    setActiveStage('nfa');
  }, [regexString, resetFrom]);

  const handleConvert = useCallback(() => {
    const sourceNFA = nfaClean ?? (inputMode === 'builder' ? normalizeNfaAutomaton(compressNFA(nfa)) : null);
    if (!sourceNFA) return;

    if (!nfaClean && inputMode === 'builder') {
      setNfaClean(sourceNFA);
      markReady('nfa');
    }

    const result = normalizeDfaAutomaton(subsetConstruction(sourceNFA));
    setDfa(result);
    resetFrom('dfa');
    setCurrentStep(-1);
    markReady('dfa');
    setActiveStage('dfa');
  }, [inputMode, nfa, nfaClean, resetFrom]);

  const handleMinimize = useCallback(() => {
    if (!dfa) return;
    const result = normalizeDfaAutomaton(hopcroftMinimize(dfa));
    setMinDfa(result);
    setMinStep(-1);
    markReady('minDfa');
    setActiveStage('minDfa');
  }, [dfa]);

  // ── Problem 8 Automata Inference Handlers ───────────────────────────
  const handleRunRPNI = useCallback((overridePos = null, overrideNeg = null, customTest = null, customRef = null) => {
    setIsLearning(true);
    const activeRef = customRef || referenceDfa;
    const activeTest = customTest || testingData;

    const pos = overridePos !== null ? overridePos : trainingData.filter(t => t.label).map(t => t.string);
    const neg = overrideNeg !== null ? overrideNeg : trainingData.filter(t => !t.label).map(t => t.string);

    setTimeout(() => {
      try {
        const { pta: newPta, inferredDFA: rawInferred, steps } = rpni(pos, neg, alphabet);
        const minInferred = normalizeDfaAutomaton(hopcroftMinimize(rawInferred));

        setPta(newPta);
        setInferredDfa(rawInferred);
        setMinInferredDfa(minInferred);
        setRpniSteps(steps);
        setRpniStep(-1);

        if (activeTest.length > 0) {
          const evalRes = evaluateDfa(rawInferred, activeTest);
          setEvaluation(evalRes);
        }

        if (activeRef) {
          const equivRes = checkDfaEquivalence(rawInferred, activeRef, alphabet);
          setEquivalence(equivRes);
        }

        markReady('inferredDfa');
        markReady('minInferredDfa');
        markReady('pta');
        setActiveStage('inferredDfa');
      } catch (err) {
        console.error('RPNI error:', err);
      } finally {
        setIsLearning(false);
      }
    }, 40);
  }, [trainingData, testingData, alphabet, referenceDfa]);

  const handleGenerateDataset = useCallback(() => {
    const targetRegex = useCustomRegex
      ? customRegex
      : (LANGUAGE_PRESETS.find(p => p.id === selectedPresetId)?.regex || '(a|b)*abb');

    const ref = buildReferenceDFA(targetRegex);
    setReferenceDfa(ref);
    markReady('refDfa');

    const { training, testing, positives, negatives } = generateDataset({
      referenceDFA: ref,
      alphabet,
      trainCount,
      testCount: 40,
      maxStringLength: maxLen,
      noiseRate,
      diversity,
    });

    setTrainingData(training);
    setTestingData(testing);

    handleRunRPNI(positives, negatives, testing, ref);
  }, [useCustomRegex, customRegex, selectedPresetId, alphabet, trainCount, maxLen, noiseRate, diversity, handleRunRPNI]);

  // Initial load for learning mode
  useEffect(() => {
    if (inputMode === 'learn' && !referenceDfa) {
      handleGenerateDataset();
    }
  }, [inputMode, referenceDfa, handleGenerateDataset]);

  const handleAddCounterexample = useCallback((str, trueLabel) => {
    const newItem = { string: str, label: trueLabel, trueLabel, isNoisy: false };
    setTrainingData(prev => {
      const updated = [newItem, ...prev.filter(p => p.string !== str)];
      const pos = updated.filter(t => t.label).map(t => t.string);
      const neg = updated.filter(t => !t.label).map(t => t.string);
      handleRunRPNI(pos, neg);
      return updated;
    });
  }, [handleRunRPNI]);

  const handleAddTrainingExample = (str, label) => {
    const newItem = { string: str, label, trueLabel: label, isNoisy: false };
    setTrainingData(prev => [...prev, newItem]);
  };

  const handleRemoveTrainingExample = (index) => {
    setTrainingData(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearTrainingData = () => {
    setTrainingData([]);
  };

  const handleModeSwitch = (mode) => {
    setInputMode(mode);
    setIsPlaying(false);
    if (mode === 'learn') {
      setActiveStage('inferredDfa');
      setRightTab('eval');
    } else {
      setActiveStage('enfa');
      setRightTab('steps');
    }
  };

  // ── Step Navigation ──────────────────────────────────────────────────
  const handleStepChange = useCallback((idx) => {
    setCurrentStep(idx);
    setMinStep(-1);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
    if (dfa && idx >= 0) {
      const step = dfa.steps[idx];
      setHighlightedNodes([step.from, step.to]);
    } else {
      setHighlightedNodes([]);
    }
  }, [dfa]);

  const handleMinStepChange = useCallback((idx) => {
    setMinStep(idx);
    setCurrentStep(-1);
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
  }, []);

  const handlePathChange = useCallback((visited, current = null, rejected = false) => {
    setIsPlaying(false);
    setPathNodes(visited || []);
    setHighlightedNodes(current ? [current] : []);
    setSimRejected(rejected);
    if (visited && visited.length > 0 && current) {
      const from = visited[visited.length - 1];
      setTraverseEdge({ from, to: current, key: Date.now() });
    } else {
      setTraverseEdge(null);
    }
    if ((visited?.length > 0) || current) {
      setCurrentStep(-1);
      setMinStep(-1);
    }
  }, []);

  // ── Auto-play simulation ─────────────────────────────────────────────
  const activeSteps   = activeStage === 'minDfa' ? (minDfa?.steps || []) : (dfa?.steps || []);
  const activeStepIdx = activeStage === 'minDfa' ? minStep : currentStep;
  const setActiveStep = activeStage === 'minDfa' ? handleMinStepChange : handleStepChange;

  useEffect(() => {
    clearTimeout(playTimerRef.current);
    if (!isPlaying || activeSteps.length === 0 || activeStepIdx >= activeSteps.length - 1) return undefined;

    const nextStep = activeStepIdx === -1 ? 0 : activeStepIdx + 1;
    playTimerRef.current = setTimeout(() => {
      setActiveStep(nextStep);
      if (nextStep >= activeSteps.length - 1) setIsPlaying(false);
    }, 900);

    return () => clearTimeout(playTimerRef.current);
  }, [isPlaying, activeStepIdx, activeSteps.length, setActiveStep]);

  const simReset = () => {
    setIsPlaying(false);
    setActiveStep(-1);
    setHighlightedNodes([]);
    setPathNodes([]);
    setTraverseEdge(null);
    setSimRejected(false);
  };

  // ── Graph Flow Data ──────────────────────────────────────────────────
  const enfaFlow = useMemo(() => {
    const src = inputMode === 'builder' ? nfa : enfa;
    return src ? nfaToFlowData(src) : null;
  }, [enfa, nfa, inputMode]);

  const nfaFlow    = useMemo(() => nfaClean ? nfaToFlowData(nfaClean) : null, [nfaClean]);
  const dfaFlow    = useMemo(() => dfa    ? dfaToFlowData(dfa,    highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [dfa,    highlightedNodes, pathNodes, traverseEdge, simRejected]);
  const minDfaFlow = useMemo(() => minDfa ? dfaToFlowData(minDfa, highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [minDfa, highlightedNodes, pathNodes, traverseEdge, simRejected]);

  // Problem 8 Graph Flows
  const refDfaFlow       = useMemo(() => referenceDfa   ? dfaToFlowData(referenceDfa,   highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [referenceDfa,   highlightedNodes, pathNodes, traverseEdge, simRejected]);
  const ptaFlow          = useMemo(() => pta            ? dfaToFlowData(pta,            highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [pta,            highlightedNodes, pathNodes, traverseEdge, simRejected]);
  const inferredDfaFlow  = useMemo(() => inferredDfa    ? dfaToFlowData(inferredDfa,    highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [inferredDfa,    highlightedNodes, pathNodes, traverseEdge, simRejected]);
  const minInferredFlow  = useMemo(() => minInferredDfa ? dfaToFlowData(minInferredDfa, highlightedNodes, pathNodes, traverseEdge, simRejected) : null, [minInferredDfa, highlightedNodes, pathNodes, traverseEdge, simRejected]);

  // ── Active Canvas Flow ───────────────────────────────────────────────
  const activeFlow = useMemo(() => {
    if (inputMode === 'learn') {
      if (activeStage === 'refDfa') return refDfaFlow;
      if (activeStage === 'pta') return ptaFlow;
      if (activeStage === 'minInferredDfa') return minInferredFlow;
      return inferredDfaFlow;
    }
    if (activeStage === 'enfa') return enfaFlow;
    if (activeStage === 'nfa')  return nfaFlow;
    if (activeStage === 'minDfa') return minDfaFlow;
    return dfaFlow;
  }, [inputMode, activeStage, refDfaFlow, ptaFlow, inferredDfaFlow, minInferredFlow, enfaFlow, nfaFlow, dfaFlow, minDfaFlow]);

  const { nodes: canvasNodes = [], edges: canvasEdges = [] } = activeFlow || {};

  // ── Pipeline Stages Config ───────────────────────────────────────────
  const pipelineStages = useMemo(() => {
    if (inputMode === 'learn') {
      return [
        { id: 'refDfa',        label: 'Target DFA',   color: 'purple',  available: !!referenceDfa,   done: !!referenceDfa },
        { id: 'pta',           label: 'PTA Tree',     color: 'indigo',  available: !!pta,            done: !!pta },
        { id: 'inferredDfa',   label: 'Inferred DFA', color: 'emerald', available: !!inferredDfa,    done: !!inferredDfa },
        { id: 'minInferredDfa',label: 'Min Inferred', color: 'amber',   available: !!minInferredDfa, done: !!minInferredDfa },
      ];
    }
    return [
      { id: 'enfa', label: 'ε-NFA', color: 'purple',
        available: inputMode === 'builder' ? true : !!enfa,
        done:      inputMode === 'builder' ? true : !!enfa },
      { id: 'nfa',    label: 'NFA',     color: 'indigo',  available: !!nfaClean, done: !!nfaClean },
      { id: 'dfa',    label: 'DFA',     color: 'emerald', available: !!dfa,      done: !!dfa },
      { id: 'minDfa', label: 'Min-DFA', color: 'amber',   available: !!minDfa,   done: !!minDfa },
    ];
  }, [inputMode, referenceDfa, pta, inferredDfa, minInferredDfa, enfa, nfaClean, dfa, minDfa]);

  // ── Active DFA for String Tester ─────────────────────────────────────
  const activeDFA = useMemo(() => {
    if (inputMode === 'learn') {
      if (activeStage === 'refDfa') return referenceDfa;
      if (activeStage === 'pta') return pta;
      if (activeStage === 'minInferredDfa') return minInferredDfa;
      return inferredDfa;
    }
    if (activeStage === 'dfa') return dfa;
    if (activeStage === 'minDfa') return minDfa;
    return null;
  }, [inputMode, activeStage, referenceDfa, pta, inferredDfa, minInferredDfa, dfa, minDfa]);

  const testPanelMessage = useMemo(() => {
    if (inputMode === 'learn') {
      return 'Generate dataset and infer DFA to test strings';
    }
    if (activeStage === 'dfa' || activeStage === 'minDfa') {
      return 'Build this machine to enable testing';
    }
    return 'Select the DFA or Min-DFA canvas to test strings';
  }, [inputMode, activeStage]);

  const activeDFAKey = useMemo(() => {
    if (!activeDFA) return `no-dfa|${activeStage}`;
    return JSON.stringify({
      mode: inputMode,
      stage: activeStage,
      start: activeDFA.startState ?? activeDFA.start ?? '',
      states: activeDFA.states ?? [],
      acceptStates: activeDFA.acceptStates ?? activeDFA.accept ?? [],
      alphabet: activeDFA.alphabet ?? [],
      transitions: activeDFA.transitions ?? {},
    });
  }, [activeDFA, activeStage, inputMode]);

  const handleStageClick = (id) => {
    setIsPlaying(false);
    clearReady(id);
    setActiveStage(id);
  };

  // ── Transition Table Data ────────────────────────────────────────────
  const tableInfo = useMemo(() => {
    if (inputMode === 'learn') {
      if (activeStage === 'refDfa')        return referenceDfa   ? { automaton: referenceDfa,   type: 'dfa',    label: 'Target DFA' }        : null;
      if (activeStage === 'pta')           return pta            ? { automaton: pta,            type: 'dfa',    label: 'Prefix Tree Acceptor' } : null;
      if (activeStage === 'minInferredDfa')return minInferredDfa ? { automaton: minInferredDfa, type: 'minDfa', label: 'Min Inferred DFA' }   : null;
      return inferredDfa ? { automaton: inferredDfa, type: 'dfa', label: 'Inferred DFA' } : null;
    }
    if (activeStage === 'enfa') {
      const src = inputMode === 'builder' ? nfa : enfa;
      return src ? { automaton: src, type: 'enfa', label: 'ε-NFA' } : null;
    }
    if (activeStage === 'nfa')    return nfaClean ? { automaton: nfaClean, type: 'nfa',    label: 'NFA' }     : null;
    if (activeStage === 'dfa')    return dfa      ? { automaton: dfa,      type: 'dfa',    label: 'DFA' }     : null;
    if (activeStage === 'minDfa') return minDfa   ? { automaton: minDfa,   type: 'minDfa', label: 'Min-DFA' } : null;
    return null;
  }, [inputMode, activeStage, referenceDfa, pta, inferredDfa, minInferredDfa, nfa, enfa, nfaClean, dfa, minDfa]);

  // ── Right Sidebar Tabs Config ────────────────────────────────────────
  const rightTabs = useMemo(() => {
    if (inputMode === 'learn') {
      return [
        { id: 'eval',      icon: '📊', label: 'Evaluation' },
        { id: 'rpniSteps', icon: '⚡', label: 'RPNI Steps' },
        { id: 'test',      icon: '▷',  label: 'Test String' },
        { id: 'table',     icon: '⊞',  label: 'Table' },
        { id: 'clusters',  icon: '🔮', label: 'Clusters' },
      ];
    }
    return [
      { id: 'steps', icon: '≡', label: activeStage === 'minDfa' ? 'Hopcroft' : 'Steps' },
      { id: 'test',  icon: '▷', label: 'Test' },
      { id: 'table', icon: '⊞', label: 'Table' },
    ];
  }, [inputMode, activeStage]);

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--bg-base)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* ── Top Stage Tabs ────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 44,
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
        zIndex: 10,
      }}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            width: sidebarOpen ? SIDEBAR_WIDTH : 44,
            flexShrink: 0,
            height: '100%',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <span style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>
            {sidebarOpen ? '◀' : '▶'}
          </span>
          {sidebarOpen && (
            <span style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
            }}>
              Automata Lab
            </span>
          )}
        </button>

        {/* Stage tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingLeft: 8, gap: 2, overflowX: 'auto' }}>
          {pipelineStages.map((stage, i) => {
            const isActive = activeStage === stage.id;
            const isReady  = readyStages.has(stage.id);
            const colorMap = {
              purple:  { active: '#b44dff', badge: '#b44dff' },
              indigo:  { active: '#6e56cf', badge: '#6e56cf' },
              emerald: { active: '#00ff88', badge: '#00b060' },
              amber:   { active: '#ffb800', badge: '#cc9000' },
            };
            const c = colorMap[stage.color] || colorMap.indigo;
            return (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => stage.available && handleStageClick(stage.id)}
                  disabled={!stage.available}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '0 16px', height: 44,
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                    cursor: stage.available ? 'pointer' : 'not-allowed',
                    opacity: stage.available ? 1 : 0.3,
                    color: isActive ? c.active : stage.done ? 'var(--text-secondary)' : 'var(--text-muted)',
                    borderBottom: isActive ? `2px solid ${c.active}` : '2px solid transparent',
                    background: isActive ? `${c.active}11` : 'transparent',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: stage.done ? c.badge : isActive ? c.active : 'var(--bg-overlay)',
                    color: stage.done || isActive ? '#fff' : 'var(--text-muted)',
                    boxShadow: isActive ? `0 0 8px ${c.active}66` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {stage.done ? '✓' : i + 1}
                  </span>
                  {stage.label}

                  {isReady && !isActive && (
                    <span style={{
                      position: 'absolute', top: 6, right: 4,
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#00ff88',
                      animation: 'pulseReady 1.5s ease-in-out infinite',
                    }} />
                  )}
                </button>

                {i < pipelineStages.length - 1 && (
                  <span style={{ color: 'var(--border)', fontSize: 12, margin: '0 4px', userSelect: 'none' }}>→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right side stats + sidebar toggle */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {inputMode === 'learn' && evaluation && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', paddingRight: 14 }}>
              Test Acc: <span style={{ color: '#00ff88', fontWeight: 700 }}>{evaluation.accuracy}%</span> ·{' '}
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{inferredDfa?.states.length || 0}</span> states
            </span>
          )}

          <button
            onClick={() => setRightSidebarOpen(o => !o)}
            title={rightSidebarOpen ? 'Collapse tools' : 'Expand tools'}
            style={{
              width: rightSidebarOpen ? SIDEBAR_WIDTH : 44,
              flexShrink: 0,
              height: 44,
              borderLeft: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              padding: '0 14px',
              gap: 8,
              background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
              transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {rightSidebarOpen && (
              <span style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--text-muted)', textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)', marginRight: 'auto',
              }}>
                Tools & Analysis
              </span>
            )}
            <span style={{ fontSize: 15, color: 'var(--text-muted)', flexShrink: 0, lineHeight: 1 }}>
              {rightSidebarOpen ? '▶' : '◀'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Main Workspace ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left Sidebar (Controls) ─────────────────────────────────── */}
        <div style={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Title block */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <h1 style={{
                margin: 0,
                fontSize: 19, fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>
                Automata Lab
              </h1>
              <p style={{
                margin: '3px 0 0',
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}>
                {inputMode === 'learn'
                  ? 'Problem 8: Learn DFA from Training Data (RPNI)'
                  : inputMode === 'regex'
                  ? 'Regex → ε-NFA → NFA → DFA → Min-DFA'
                  : 'Manual NFA → NFA → DFA → Min-DFA'}
              </p>

              {/* Mode toggle */}
              <div style={{
                display: 'flex', gap: 4, marginTop: 10,
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: 3, border: '1px solid var(--border-subtle)',
              }}>
                {[
                  { id: 'learn',   label: '⚡ Learn (P8)' },
                  { id: 'regex',   label: '✦ Regex' },
                  { id: 'builder', label: '⚙ Builder' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleModeSwitch(m.id)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6,
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      background: inputMode === m.id ? 'var(--accent)' : 'transparent',
                      color: inputMode === m.id ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s',
                      boxShadow: inputMode === m.id ? '0 2px 8px rgba(110,86,207,0.35)' : 'none',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input panel (scrollable) */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {inputMode === 'learn' ? (
                <DatasetManager
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={setSelectedPresetId}
                  customRegex={customRegex}
                  onChangeCustomRegex={setCustomRegex}
                  useCustomRegex={useCustomRegex}
                  onToggleUseCustomRegex={setUseCustomRegex}
                  alphabet={alphabet}
                  onChangeAlphabet={setAlphabet}
                  trainCount={trainCount}
                  onChangeTrainCount={setTrainCount}
                  maxLen={maxLen}
                  onChangeMaxLen={setMaxLen}
                  noiseRate={noiseRate}
                  onChangeNoiseRate={setNoiseRate}
                  diversity={diversity}
                  onChangeDiversity={setDiversity}
                  onGenerateDataset={handleGenerateDataset}
                  onRunRPNI={() => handleRunRPNI()}
                  trainingData={trainingData}
                  onAddTrainingExample={handleAddTrainingExample}
                  onRemoveTrainingExample={handleRemoveTrainingExample}
                  onClearTrainingData={handleClearTrainingData}
                  testingData={testingData}
                  isLearning={isLearning}
                />
              ) : inputMode === 'builder' ? (
                <NFABuilder
                  nfa={nfa}
                  onNFAChange={(n) => { setNfa(normalizeNfaAutomaton(n)); setNfaClean(null); resetFrom('nfa'); setActiveStage('enfa'); }}
                  onConvert={handleConvert}
                  onMinimize={handleMinimize}
                  hasDfa={!!dfa}
                  hasMinDfa={!!minDfa}
                />
              ) : (
                <RegexInput
                  onBuild={handleBuildFromRegex}
                  built={!!enfa}
                  hasNfaClean={!!nfaClean}
                  hasDfa={!!dfa}
                  hasMinDfa={!!minDfa}
                  onRemoveEpsilon={handleRemoveEpsilon}
                  onConvert={handleConvert}
                  onMinimize={handleMinimize}
                  activeStage={activeStage}
                  onStageChange={handleStageClick}
                />
              )}
            </div>

          </div>
        </div>

        {/* ── Canvas Area ────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          {canvasNodes.length > 0 ? (
            <GraphView nodes={canvasNodes} edges={canvasEdges} />
          ) : (
            <EmptyCanvas activeStage={activeStage} inputMode={inputMode} />
          )}

          {/* Stage label overlay */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(13,17,23,0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--text-secondary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activeStage === 'inferredDfa' || activeStage === 'dfa' ? '#00ff88' : activeStage === 'minInferredDfa' || activeStage === 'minDfa' ? '#ffb800' : '#6e56cf',
            }} />
            <span>
              {inputMode === 'learn'
                ? activeStage === 'refDfa' ? 'Target Reference DFA' : activeStage === 'pta' ? 'Prefix Tree Acceptor (PTA)' : activeStage === 'minInferredDfa' ? 'Minimized Inferred DFA' : 'Inferred DFA (RPNI)'
                : activeStage.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              ({canvasNodes.length} states)
            </span>
          </div>
        </div>

        {/* ── Right Sidebar (Tools & Analysis) ───────────────────────── */}
        <div style={{
          width: rightSidebarOpen ? SIDEBAR_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Tab bar */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
            }}>
              {rightTabs.map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)}
                  style={{
                    flex: 1, padding: '10px 2px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
                    cursor: 'pointer',
                    border: 'none',
                    color: rightTab === tab.id ? '#38bdf8' : 'var(--text-muted)',
                    borderBottom: rightTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                    background: rightTab === tab.id ? 'rgba(56,189,248,0.07)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 15 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

              {/* Evaluation Tab (Problem 8) */}
              {rightTab === 'eval' && (
                <EvaluationPanel
                  evaluation={evaluation}
                  equivalence={equivalence}
                  referenceDFA={referenceDfa}
                  inferredDFA={inferredDfa}
                  alphabet={alphabet}
                  onAddCounterexample={handleAddCounterexample}
                />
              )}

              {/* RPNI Step-by-Step Tab (Problem 8) */}
              {rightTab === 'rpniSteps' && (
                <RPNIStepPanel
                  steps={rpniSteps}
                  currentStep={rpniStep}
                  onStepChange={setRpniStep}
                />
              )}

              {/* State Clustering Tab (Problem 8) */}
              {rightTab === 'clusters' && (
                <StateClusteringPanel
                  dfa={activeDFA}
                  k={2}
                />
              )}

              {/* Classical Steps Tab */}
              {rightTab === 'steps' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  {(activeStage === 'dfa' || activeStage === 'minDfa') && activeSteps.length > 0 && (
                    <div style={{
                      flexShrink: 0, padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--bg-elevated)',
                    }}>
                      <SimBtn title="First" disabled={activeStepIdx <= 0}
                        onClick={() => setActiveStep(0)}>⏮</SimBtn>
                      <SimBtn title="Back" disabled={activeStepIdx <= 0}
                        onClick={() => setActiveStep(Math.max(0, activeStepIdx - 1))}>‹</SimBtn>
                      <SimBtn title={isPlaying ? 'Pause' : 'Play'} active={isPlaying}
                        onClick={() => setIsPlaying(p => !p)}>
                        {isPlaying ? '⏸' : '▶'}
                      </SimBtn>
                      <SimBtn title="Forward" disabled={activeStepIdx >= activeSteps.length - 1}
                        onClick={() => setActiveStep(activeStepIdx === -1 ? 0 : Math.min(activeSteps.length - 1, activeStepIdx + 1))}>›</SimBtn>
                      <SimBtn title="Last" disabled={activeStepIdx >= activeSteps.length - 1}
                        onClick={() => setActiveStep(activeSteps.length - 1)}>⏭</SimBtn>
                      <SimBtn title="Reset" onClick={simReset}>&#8634;</SimBtn>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        color: 'var(--text-muted)', marginLeft: 'auto',
                        minWidth: 42, textAlign: 'right',
                      }}>
                        {activeStepIdx >= 0 ? `${activeStepIdx + 1}/${activeSteps.length}` : `—/${activeSteps.length}`}
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    {activeStage === 'minDfa' ? (
                      <MinStepPanel
                        steps={minDfa?.steps || []}
                        currentStep={minStep}
                        onStepChange={handleMinStepChange}
                        partitionMap={minDfa?.partitionMap}
                        stats={minDfa ? { original: minDfa.originalStateCount, minimized: minDfa.minimizedStateCount } : null}
                      />
                    ) : (
                      <StepPanel
                        steps={dfa?.steps || []}
                        currentStep={currentStep}
                        onStepChange={handleStepChange}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* String Simulator Tab */}
              {rightTab === 'test' && (
                <StringTester
                  key={activeDFAKey}
                  dfa={activeDFA}
                  emptyMessage={testPanelMessage}
                  onPathChange={handlePathChange}
                />
              )}

              {/* Transition Table Tab */}
              {rightTab === 'table' && (
                tableInfo ? (
                  <RightSidebarTable
                    automaton={tableInfo.automaton}
                    type={tableInfo.type}
                    label={tableInfo.label}
                  />
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:8, padding:20 }}>
                    <span style={{ fontSize: 36, opacity: 0.25 }}>∅</span>
                    <p style={{ fontSize: 13, fontFamily:'var(--font-mono)', color:'var(--text-muted)', textAlign:'center', margin:0, lineHeight: 1.6 }}>
                      No automaton built<br/>for this stage yet
                    </p>
                  </div>
                )
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sim Button Helper ─────────────────────────────────────────────────────
function SimBtn({ children, onClick, disabled, title, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`sim-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

// ── Empty Canvas Placeholder ──────────────────────────────────────────────
function EmptyCanvas({ activeStage, inputMode }) {
  const messages = {
    refDfa:         { icon: '🎯', text: 'Target Reference DFA', sub: 'Ground-truth regular language model' },
    pta:            { icon: '🌳', text: 'Prefix Tree Acceptor (PTA)', sub: 'Tree-shaped DFA constructed from positive examples S+' },
    inferredDfa:    { icon: '⚡', text: 'Inferred DFA (RPNI)', sub: 'Click "Infer DFA" in sidebar to learn automaton' },
    minInferredDfa: { icon: '✦', text: 'Minimized Inferred DFA', sub: 'Hopcroft minimization of the learned machine' },
    enfa:           { icon: '✦', text: 'Enter a regex in the sidebar and click "Build ε-NFA"', sub: "Thompson's construction" },
    nfa:            { icon: '∿', text: inputMode === 'regex' ? 'Click "Remove ε-transitions → NFA" in sidebar' : 'Your NFA from the builder will appear here', sub: 'ε-closure elimination' },
    dfa:            { icon: '⚡', text: 'Click "Convert → DFA" in the sidebar', sub: 'Subset construction algorithm' },
    minDfa:         { icon: '✦', text: 'Click "Minimize DFA" in the sidebar', sub: "Hopcroft's algorithm" },
  };
  const msg = messages[activeStage] || messages.inferredDfa || messages.dfa;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, userSelect: 'none',
      background: 'var(--bg-base)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} />

      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 10,
        padding: '32px 48px',
        background: 'rgba(13,17,23,0.8)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16, border: '1px solid var(--border-subtle)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <span style={{ fontSize: 44, opacity: 0.5 }}>{msg.icon}</span>
        <p style={{
          margin: 0, fontSize: 16, fontFamily: 'var(--font-body)',
          color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center',
        }}>{msg.text}</p>
        <p style={{
          margin: 0, fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}>{msg.sub}</p>
      </div>
    </div>
  );
}

// ── Right Sidebar Transition Table ────────────────────────────────────────
function RightSidebarTable({ automaton, type }) {
  if (!automaton) return null;

  const states       = automaton.states       || [];
  const alphabet     = automaton.alphabet     || [];
  const transitions  = automaton.transitions  || {};
  const epsilon      = automaton.epsilon      || {};
  const startState   = automaton.startState   || automaton.start   || '';
  const acceptStates = automaton.acceptStates || automaton.accept  || [];

  const showEpsilon = type === 'enfa';

  const formatTarget = (val) => {
    if (!val) return '—';
    if (Array.isArray(val)) {
      if (val.length === 0) return '—';
      return `{${val.join(', ')}}`;
    }
    return String(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        flexShrink: 0, padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-elevated)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          δ Transition Function
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {states.length} states · Σ = {'{'}{alphabet.join(', ')}{'}'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)', fontSize: 12,
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{
                textAlign: 'left', padding: '6px 8px',
                color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
              }}>
                State
              </th>
              {alphabet.map(sym => (
                <th key={sym} style={{
                  textAlign: 'center', padding: '6px 8px',
                  color: 'var(--neon-cyan)', fontWeight: 700, fontSize: 12,
                }}>
                  {sym}
                </th>
              ))}
              {showEpsilon && (
                <th style={{
                  textAlign: 'center', padding: '6px 8px',
                  color: 'var(--neon-purple)', fontWeight: 700, fontSize: 12,
                }}>
                  ε
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {states.map(state => {
              const isStart  = state === startState;
              const isAccept = acceptStates.includes(state);
              return (
                <tr
                  key={state}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: isAccept ? 'rgba(0,255,136,0.03)' : isStart ? 'rgba(110,86,207,0.04)' : 'transparent',
                  }}
                >
                  <td style={{
                    padding: '7px 8px',
                    fontWeight: 700,
                    color: isAccept ? 'var(--neon-green)' : isStart ? '#b44dff' : 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ fontSize: 10, marginRight: 3, opacity: 0.8 }}>
                      {isStart && isAccept ? '➔*' : isStart ? '➔' : isAccept ? '*' : ' '}
                    </span>
                    {state}
                  </td>

                  {alphabet.map(sym => {
                    const raw = transitions[state]?.[sym];
                    const val = formatTarget(raw);
                    const isEmpty = val === '—';
                    return (
                      <td key={sym} style={{
                        textAlign: 'center', padding: '7px 8px',
                        color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)',
                        opacity: isEmpty ? 0.35 : 1,
                        fontSize: 11,
                      }}>
                        {val}
                      </td>
                    );
                  })}

                  {showEpsilon && (
                    <td style={{
                      textAlign: 'center', padding: '7px 8px',
                      color: formatTarget(epsilon[state]) === '—' ? 'var(--text-muted)' : '#d8b4fe',
                      opacity: formatTarget(epsilon[state]) === '—' ? 0.35 : 1,
                      fontSize: 11,
                    }}>
                      {formatTarget(epsilon[state])}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
