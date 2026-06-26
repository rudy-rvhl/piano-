import { useCallback, useEffect, useRef, useState } from "react";
import FlashStaff from "../components/FlashStaff";
import Piano from "../components/Piano";
import InputControls from "../components/InputControls";
import { noteBus } from "../lib/noteBus";
import { NOTE_NAMES_SHARP, midiToName, type Clef } from "../lib/notes";
import { useSettings } from "../store/useSettings";
import { useInstructorContext } from "../store/useInstructorContext";
import { recordAnswer } from "../lib/readingStats";

interface Level {
  id: string;
  name: string;
  clef: "treble" | "bass" | "both";
  min: number;
  max: number;
  accidentals: boolean;
}

const LEVELS: Level[] = [
  { id: "treble-basic", name: "Treble · Lines & Spaces", clef: "treble", min: 64, max: 77, accidentals: false },
  { id: "treble-ledger", name: "Treble · with Ledger", clef: "treble", min: 60, max: 81, accidentals: false },
  { id: "bass-basic", name: "Bass · Lines & Spaces", clef: "bass", min: 43, max: 57, accidentals: false },
  { id: "bass-ledger", name: "Bass · with Ledger", clef: "bass", min: 36, max: 60, accidentals: false },
  { id: "grand", name: "Both Clefs", clef: "both", min: 48, max: 79, accidentals: false },
  { id: "sharps", name: "Sharps (Treble)", clef: "treble", min: 60, max: 79, accidentals: true },
];

const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

const randInt = (a: number, b: number) =>
  a + Math.floor(Math.random() * (b - a + 1));

function pickTarget(level: Level): { midi: number; clef: Clef } {
  let midi = level.min;
  for (let i = 0; i < 200; i++) {
    midi = randInt(level.min, level.max);
    if (level.accidentals || NATURALS.has(((midi % 12) + 12) % 12)) break;
  }
  const clef: Clef =
    level.clef === "both" ? (midi >= 60 ? "treble" : "bass") : level.clef;
  return { midi, clef };
}

export default function ReadingPage() {
  const settings = useSettings();
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [target, setTarget] = useState(() => pickTarget(LEVELS[0]));
  const [answerMode, setAnswerMode] = useState<"name" | "play">("name");
  const [feedback, setFeedback] = useState<"idle" | "good" | "bad">("idle");
  const [message, setMessage] = useState("");
  const [pianoFeedback, setPianoFeedback] = useState<
    Record<number, "correct" | "wrong">
  >({});
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, best: 0 });

  const lockRef = useRef(false);
  const targetRef = useRef(target);
  targetRef.current = target;
  const modeRef = useRef(answerMode);
  modeRef.current = answerMode;

  const nextQuestion = useCallback(
    (lvl: Level) => {
      lockRef.current = false;
      setFeedback("idle");
      setMessage("");
      setPianoFeedback({});
      setTarget(pickTarget(lvl));
    },
    [],
  );

  const targetLetter = (midi: number) => NOTE_NAMES_SHARP[((midi % 12) + 12) % 12][0];

  const judge = useCallback(
    (correct: boolean, pressedMidi?: number) => {
      if (lockRef.current) return;
      lockRef.current = true;
      const t = targetRef.current;
      const name = midiToName(t.midi, settings.useFlats);

      setStats((s) => {
        const streak = correct ? s.streak + 1 : 0;
        const best = Math.max(s.best, streak);
        recordAnswer(level.id, correct, streak);
        return {
          correct: s.correct + (correct ? 1 : 0),
          total: s.total + 1,
          streak,
          best,
        };
      });

      if (correct) {
        setFeedback("good");
        setMessage(`✓ ${name}`);
        if (pressedMidi != null)
          setPianoFeedback({ [pressedMidi]: "correct" });
        setTimeout(() => nextQuestion(level), 700);
      } else {
        setFeedback("bad");
        setMessage(`✗ It was ${name}`);
        if (pressedMidi != null) {
          setPianoFeedback({ [pressedMidi]: "wrong", [t.midi]: "correct" });
        }
        setTimeout(() => nextQuestion(level), 1400);
      }
    },
    [level, nextQuestion, settings.useFlats],
  );

  // Name-mode answer
  const answerName = (letter: string) => {
    if (answerMode !== "name" || lockRef.current) return;
    judge(letter === targetLetter(targetRef.current.midi));
  };

  // Play-mode answer (listen to the note bus)
  useEffect(() => {
    const off = noteBus.onNoteOn((e) => {
      if (modeRef.current !== "play" || lockRef.current) return;
      const t = targetRef.current;
      const ok = settings.octaveTolerant
        ? e.midi % 12 === t.midi % 12
        : e.midi === t.midi;
      judge(ok, e.midi);
    });
    return off;
  }, [judge, settings.octaveTolerant]);

  const changeLevel = (lvl: Level) => {
    setLevel(lvl);
    setStats({ correct: 0, total: 0, streak: 0, best: 0 });
    nextQuestion(lvl);
  };

  const accuracy = stats.total
    ? Math.round((stats.correct / stats.total) * 100)
    : 100;

  // Keep the AI instructor aware of the reading drill in progress.
  const setInstructorContext = useInstructorContext((s) => s.setContext);
  useEffect(() => {
    setInstructorContext({
      page: "reading",
      readingLevel: level.name,
      readingStreak: stats.streak,
      pieceTitle: undefined,
      composer: undefined,
      measure: undefined,
      expectedNotes: undefined,
    });
  }, [level, stats.streak, setInstructorContext]);

  // Keyboard shortcuts for name mode (C D E F G A B keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answerMode !== "name") return;
      const k = e.key.toUpperCase();
      if (LETTERS.includes(k)) answerName(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerMode]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Read the Notes</h1>
          <div className="sub">
            Learn to read the staff — name each note, or play it on the keyboard.
          </div>
        </div>
        {answerMode === "play" && <InputControls />}
      </div>

      <div className="practice-toolbar">
        <select
          className="btn"
          value={level.id}
          onChange={(e) =>
            changeLevel(LEVELS.find((l) => l.id === e.target.value) ?? LEVELS[0])
          }
          style={{ minWidth: 200 }}
        >
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <div className="btn-row">
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            Answer by
          </span>
          <button
            className={`btn btn-sm ${answerMode === "name" ? "btn-primary" : ""}`}
            onClick={() => setAnswerMode("name")}
          >
            Name
          </button>
          <button
            className={`btn btn-sm ${answerMode === "play" ? "btn-primary" : ""}`}
            onClick={() => setAnswerMode("play")}
          >
            Play
          </button>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="num">{stats.streak}</span>
          <span className="cap">Streak</span>
        </div>
        <div className="stat">
          <span className="num">{accuracy}%</span>
          <span className="cap">Accuracy</span>
        </div>
        <div className="stat">
          <span className="num">{stats.correct}</span>
          <span className="cap">Correct</span>
        </div>
        <div className="stat">
          <span className="num">{stats.best}</span>
          <span className="cap">Best streak</span>
        </div>
      </div>

      <div className="trainer">
        <div className="staff-card">
          <FlashStaff midi={target.midi} clef={target.clef} />
        </div>

        <div className={`trainer-feedback ${feedback === "idle" ? "" : feedback}`}>
          {message || (answerMode === "name" ? "Which note is this?" : "Play this note")}
        </div>

        {answerMode === "name" ? (
          <div className="choice-grid">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                className="btn choice"
                onClick={() => answerName(letter)}
                disabled={feedback !== "idle"}
              >
                {letter}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted center">
            Use the keyboard below, your MIDI piano, or the microphone.
          </p>
        )}
      </div>

      {answerMode === "play" && (
        <>
          <div style={{ height: 220 }} />
          <div className="piano-dock">
            <div className="piano-meta">
              <span>Play the note shown on the staff above</span>
            </div>
            <Piano lowMidi={48} highMidi={84} feedback={pianoFeedback} />
          </div>
        </>
      )}
    </div>
  );
}
