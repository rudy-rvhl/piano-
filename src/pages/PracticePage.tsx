import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ScoreView from "../components/ScoreView";
import Piano from "../components/Piano";
import InputControls from "../components/InputControls";
import { ScoreEngine } from "../lib/scoreEngine";
import { usePractice } from "../lib/usePractice";
import { getScoreMeta, getScoreXml, type ScoreMeta } from "../lib/storage";
import { useSettings } from "../store/useSettings";
import { useInstructorContext } from "../store/useInstructorContext";
import { midiToName } from "../lib/notes";

export default function PracticePage() {
  const { id = "" } = useParams();
  const [xml, setXml] = useState<string | null>(null);
  const [meta, setMeta] = useState<ScoreMeta | null>(null);
  const [engine, setEngine] = useState<ScoreEngine | null>(null);
  const [notFound, setNotFound] = useState(false);

  const settings = useSettings();

  useEffect(() => {
    let active = true;
    setEngine(null);
    setXml(null);
    Promise.all([getScoreXml(id), getScoreMeta(id)]).then(([x, m]) => {
      if (!active) return;
      if (!x) {
        setNotFound(true);
        return;
      }
      setXml(x);
      setMeta(m ?? null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const practice = usePractice(engine, {
    scoreId: id,
    waitMode: settings.waitMode,
    octaveTolerant: settings.octaveTolerant,
    showHints: settings.showHints,
  });
  const { state, hints } = practice;

  // Keep the AI instructor aware of what's being practised.
  const setInstructorContext = useInstructorContext((s) => s.setContext);
  useEffect(() => {
    setInstructorContext({
      page: "practice",
      pieceTitle: meta?.title,
      composer: meta?.composer,
      measure: state.measure,
      expectedNotes: state.expected.map((m) => midiToName(m, settings.useFlats)),
      waitMode: settings.waitMode,
      lastAccuracy: meta?.progress.bestAccuracy,
    });
  }, [
    meta,
    state.measure,
    state.expected,
    settings.waitMode,
    settings.useFlats,
    setInstructorContext,
  ]);

  // Choose a keyboard range that comfortably covers the piece.
  const range = useMemo(() => {
    if (!engine || engine.steps.length === 0) return { low: 48, high: 84 };
    let min = 127;
    let max = 0;
    for (const s of engine.steps) {
      for (const m of s.midis) {
        min = Math.min(min, m);
        max = Math.max(max, m);
      }
    }
    if (max < min) return { low: 48, high: 84 };
    let low = Math.floor(min / 12) * 12;
    let high = Math.ceil((max + 1) / 12) * 12;
    while (high - low < 24) high += 12;
    return { low: Math.max(21, low), high: Math.min(108, high) };
  }, [engine]);

  if (notFound) {
    return (
      <div className="empty-state">
        <div className="big">🤷</div>
        <p>That score isn’t in your library.</p>
        <Link to="/" className="btn btn-primary">
          Back to Library
        </Link>
      </div>
    );
  }

  const pct = state.total ? Math.round((state.index / state.total) * 100) : 0;
  const accuracyPct = Math.round(state.accuracy * 100);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{meta?.title ?? "Practice"}</h1>
          <div className="sub">
            <Link to="/">← Library</Link>
            {meta?.composer ? ` · ${meta.composer}` : ""}
          </div>
        </div>
        <InputControls />
      </div>

      <div className="practice-toolbar">
        {!state.started ? (
          <button
            className="btn btn-primary"
            onClick={practice.start}
            disabled={!engine}
          >
            ▶ Start practice
          </button>
        ) : (
          <button className="btn" onClick={practice.restart}>
            ↻ Restart
          </button>
        )}
        {!state.playing ? (
          <button className="btn btn-gold" onClick={practice.play} disabled={!engine}>
            🔈 Listen
          </button>
        ) : (
          <button className="btn" onClick={practice.stop}>
            ⏹ Stop
          </button>
        )}

        <span style={{ flex: 1 }} />

        <Toggle
          label="Wait for me"
          on={settings.waitMode}
          onChange={settings.setWaitMode}
        />
        <Toggle
          label="Show hints"
          on={settings.showHints}
          onChange={settings.setShowHints}
        />
        <Toggle
          label="Any octave"
          on={settings.octaveTolerant}
          onChange={settings.setOctaveTolerant}
        />
        <Toggle
          label="Key names"
          on={settings.showKeyLabels}
          onChange={settings.setShowKeyLabels}
        />
      </div>

      {state.done ? (
        <div className="banner" style={{ marginBottom: 14 }}>
          🎉 <strong>Nice!</strong> You finished with {accuracyPct}% accuracy (
          {state.hits} correct, {state.misses} slips).{" "}
          <button
            className="btn btn-sm btn-primary"
            style={{ marginLeft: 8 }}
            onClick={practice.restart}
          >
            Play again
          </button>
        </div>
      ) : (
        <div className="next-up">
          <div>
            <div className="label">
              {state.playing
                ? "Listening"
                : state.started
                  ? "Play these"
                  : "Press Start"}
            </div>
            <div className="notes">
              {state.expected.length === 0 ? (
                <span className="muted">
                  {state.started ? "—" : "Ready when you are"}
                </span>
              ) : (
                state.expected.map((m) => (
                  <span
                    key={m}
                    className={`note-chip${
                      state.satisfied.includes(m) ? " done" : ""
                    }`}
                  >
                    {midiToName(m, settings.useFlats)}
                  </span>
                ))
              )}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <div className="stat">
            <span className="num">{state.measure}</span>
            <span className="cap">Measure</span>
          </div>
        </div>
      )}

      <div className="progress-bar" style={{ marginBottom: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="stat-row"
        style={{ marginBottom: 16, justifyContent: "space-between" }}
      >
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          Note {Math.min(state.index + 1, state.total || 1)} of {state.total}
        </span>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          ✓ {state.hits} · ✗ {state.misses} · {accuracyPct}% accuracy
        </span>
      </div>

      <ScoreView xml={xml} onReady={setEngine} />

      <div style={{ height: 240 }} />

      <div className="piano-dock">
        <div className="piano-meta">
          <span>
            {state.started
              ? "Play the highlighted notes"
              : state.playing
                ? "Follow the highlighted notes"
                : "Free play — tap the keys or use your A–K computer keys"}
          </span>
          <span>{range.low === 48 ? "" : ""}</span>
        </div>
        <Piano
          lowMidi={range.low}
          highMidi={range.high}
          hintMidis={hints}
          feedback={state.feedback}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`toggle${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
      style={{ background: "none", border: "none" }}
      type="button"
    >
      <span className="switch" />
      {label}
    </button>
  );
}
