// The brain of practice mode. Given a loaded ScoreEngine, it walks the score
// one onset at a time, highlights the note(s) due, and waits until the player
// produces them (in wait mode) before advancing — the core "Skoove" mechanic.
// It also powers note-by-note playback so learners can hear the piece.

import { useCallback, useEffect, useRef, useState } from "react";
import { ScoreEngine, type Hand } from "./scoreEngine";
import { noteBus } from "./noteBus";
import { playChord } from "./audio";
import { recordPractice } from "./storage";

export interface PracticeState {
  started: boolean;
  done: boolean;
  playing: boolean;
  index: number;
  total: number;
  measure: number;
  expected: number[];
  satisfied: number[];
  feedback: Record<number, "correct" | "wrong">;
  hits: number;
  misses: number;
  accuracy: number;
}

interface Options {
  scoreId: string;
  waitMode: boolean;
  octaveTolerant: boolean;
  showHints: boolean;
  hand: Hand;
}

const sameClass = (a: number, b: number) => (a - b) % 12 === 0;

export function usePractice(engine: ScoreEngine | null, opts: Options) {
  const [state, setState] = useState<PracticeState>({
    started: false,
    done: false,
    playing: false,
    index: 0,
    total: 0,
    measure: 1,
    expected: [],
    satisfied: [],
    feedback: {},
    hits: 0,
    misses: 0,
    accuracy: 1,
  });

  // Mutable mirrors so the note-bus handler never reads stale React state.
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const playingRef = useRef(false);
  const expectedRef = useRef<number[]>([]);
  const satisfiedRef = useRef<Set<number>>(new Set());
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const wrongTimers = useRef<Map<number, number>>(new Map());
  const playTimer = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const computeAccuracy = () => {
    const h = hitsRef.current;
    const m = missesRef.current;
    return h + m === 0 ? 1 : h / (h + m);
  };

  const sync = useCallback((extra: Partial<PracticeState> = {}) => {
    if (!engine) return;
    const satisfiedMidis = [...satisfiedRef.current].map(
      (i) => expectedRef.current[i],
    );
    const feedback: Record<number, "correct" | "wrong"> = {};
    satisfiedMidis.forEach((m) => (feedback[m] = "correct"));
    wrongTimers.current.forEach((_t, midi) => (feedback[midi] = "wrong"));
    setState((s) => ({
      ...s,
      started: startedRef.current,
      done: doneRef.current,
      playing: playingRef.current,
      index: engine.index,
      total: engine.total,
      measure: engine.current?.measure ?? s.measure,
      expected: [...expectedRef.current],
      satisfied: satisfiedMidis,
      feedback,
      hits: hitsRef.current,
      misses: missesRef.current,
      accuracy: computeAccuracy(),
      ...extra,
    }));
  }, [engine]);

  // Move past any rests, then load the notes due at the cursor.
  const loadStep = useCallback(() => {
    if (!engine) return;
    const hand = optsRef.current.hand;
    // Skip rests and onsets where the selected hand has nothing to play.
    while (
      !engine.atEnd() &&
      (engine.current?.isRest || engine.expectedMidis(hand).length === 0)
    ) {
      engine.next();
    }
    expectedRef.current = engine.expectedMidis(hand);
    satisfiedRef.current = new Set();
  }, [engine]);

  const finish = useCallback(() => {
    startedRef.current = false;
    doneRef.current = true;
    expectedRef.current = [];
    const acc = computeAccuracy();
    recordPractice(optsRef.current.scoreId, acc).catch(() => {});
    sync();
  }, [sync]);

  const advance = useCallback(() => {
    if (!engine) return;
    const more = engine.next();
    if (!more) {
      finish();
      return;
    }
    loadStep();
    if (engine.atEnd()) {
      finish();
      return;
    }
    sync();
  }, [engine, finish, loadStep, sync]);

  const flashWrong = useCallback(
    (midi: number) => {
      const existing = wrongTimers.current.get(midi);
      if (existing) window.clearTimeout(existing);
      const t = window.setTimeout(() => {
        wrongTimers.current.delete(midi);
        sync();
      }, 280);
      wrongTimers.current.set(midi, t);
      sync();
    },
    [sync],
  );

  // The single handler for every incoming note (screen / MIDI / mic).
  useEffect(() => {
    const off = noteBus.onNoteOn((e) => {
      if (
        !startedRef.current ||
        doneRef.current ||
        playingRef.current ||
        !optsRef.current.waitMode
      )
        return;
      const expected = expectedRef.current;
      if (expected.length === 0) return;

      const tol = optsRef.current.octaveTolerant;
      const matchIdx = expected.findIndex(
        (m, i) =>
          !satisfiedRef.current.has(i) &&
          (tol ? sameClass(e.midi, m) : e.midi === m),
      );

      if (matchIdx >= 0) {
        satisfiedRef.current.add(matchIdx);
        hitsRef.current += 1;
        if (satisfiedRef.current.size === expected.length) {
          // Whole onset satisfied — show it green briefly, then advance.
          sync();
          window.setTimeout(() => advance(), 90);
        } else {
          sync();
        }
      } else {
        missesRef.current += 1;
        flashWrong(e.midi);
      }
    });
    return off;
  }, [advance, flashWrong, sync]);

  const start = useCallback(() => {
    if (!engine) return;
    stopPlayback();
    engine.resetCursor();
    hitsRef.current = 0;
    missesRef.current = 0;
    doneRef.current = false;
    startedRef.current = true;
    loadStep();
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, loadStep, sync]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  // --- playback (listen mode) ---------------------------------------------
  const stopPlayback = useCallback(() => {
    if (playTimer.current) {
      window.clearTimeout(playTimer.current);
      playTimer.current = null;
    }
    if (playingRef.current) {
      playingRef.current = false;
      sync();
    }
  }, [sync]);

  const play = useCallback(() => {
    if (!engine) return;
    startedRef.current = false;
    doneRef.current = false;
    playingRef.current = true;
    engine.resetCursor();

    const tick = () => {
      if (!playingRef.current || !engine) return;
      if (engine.atEnd()) {
        stopPlayback();
        engine.resetCursor();
        expectedRef.current = [];
        sync();
        return;
      }
      const cur = engine.current;
      const secPerBeat = 60 / (engine.tempo || 90);
      const durSec = (cur?.durationBeats ?? 1) * secPerBeat;
      if (cur && !cur.isRest) {
        expectedRef.current = cur.midis;
        playChord(cur.midis, Math.max(0.18, durSec * 0.92));
      } else {
        expectedRef.current = [];
      }
      sync();
      playTimer.current = window.setTimeout(() => {
        if (!playingRef.current) return;
        engine.next();
        tick();
      }, Math.max(160, durSec * 1000));
    };
    sync();
    tick();
  }, [engine, stopPlayback, sync]);

  // Reset everything when the score changes.
  useEffect(() => {
    startedRef.current = false;
    doneRef.current = false;
    playingRef.current = false;
    expectedRef.current = [];
    satisfiedRef.current = new Set();
    hitsRef.current = 0;
    missesRef.current = 0;
    if (engine) sync();
    return () => stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const hints =
    state.playing || (optsRef.current.showHints && state.started)
      ? state.expected.filter((m) => !state.satisfied.includes(m))
      : [];

  return { state, hints, start, restart, play, stop: stopPlayback };
}
