import FlashStaff from "./FlashStaff";
import { bestClef, midiToName } from "../lib/notes";
import { describeNote } from "../lib/noteTeacher";
import { initAudio, playChord, playNote } from "../lib/audio";

interface NoteCoachProps {
  midis: number[];
  useFlats?: boolean;
  /** Shown above the card, e.g. "Up next" or "This note". */
  caption?: string;
}

/**
 * Explains the note(s) currently in focus: where they sit on the staff, their
 * English + French names, and a mnemonic — with a button to hear them.
 */
export default function NoteCoach({
  midis,
  useFlats = false,
  caption = "This note",
}: NoteCoachProps) {
  if (!midis.length) {
    return (
      <div className="note-coach empty">
        <div className="coach-hint">
          ▶ Start practice (or press Listen) and the note guide will explain each
          note as you go.
        </div>
      </div>
    );
  }

  const primary = Math.min(...midis);
  const clef = bestClef(primary);
  const lesson = describeNote(primary, clef, useFlats);
  const isChord = midis.length > 1;

  const hear = () => {
    void initAudio();
    if (isChord) playChord(midis, 0.9);
    else playNote(primary, 0.9);
  };

  return (
    <div className="note-coach">
      <div className="coach-stave">
        <FlashStaff midi={primary} clef={clef} width={150} />
      </div>

      <div className="coach-body">
        <div className="coach-caption">{caption}</div>
        <div className="coach-names">
          <span className="coach-letter">{lesson.letter}</span>
          <span className="coach-sub">
            {lesson.solfege}
            <span className="coach-octave"> · {lesson.english}</span>
          </span>
        </div>
        <p className="coach-position">
          It sits {lesson.position}.
        </p>
        <p className="coach-mnemonic">💡 {lesson.mnemonic}</p>

        {isChord && (
          <div className="coach-chord">
            <span className="muted">Chord:</span>{" "}
            {midis.map((m) => (
              <span key={m} className="note-chip sm">
                {midiToName(m, useFlats)}
              </span>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-gold coach-hear" onClick={hear}>
        🔊 Hear it
      </button>
    </div>
  );
}
