import { useEffect, useMemo, useRef, useState } from "react";
import {
  isBlackKey,
  midiToName,
  midiToPitchClassName,
  MIDDLE_C,
} from "../lib/notes";
import { noteBus } from "../lib/noteBus";
import { initAudio } from "../lib/audio";
import { useSettings } from "../store/useSettings";

interface PianoProps {
  lowMidi?: number;
  highMidi?: number;
  /** Keys to highlight as "play me" hints. */
  hintMidis?: number[];
  /** Per-key feedback colouring. */
  feedback?: Record<number, "correct" | "wrong">;
  /** Enable typing on the computer keyboard to play. */
  computerKeys?: boolean;
}

// Physical-key -> semitone offset from the base octave.
const KEY_MAP: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
};

export default function Piano({
  lowMidi = 48,
  highMidi = 84,
  hintMidis = [],
  feedback = {},
  computerKeys = true,
}: PianoProps) {
  const { showKeyLabels, useFlats } = useSettings();
  const [active, setActive] = useState<Set<number>>(new Set());
  const baseOctaveRef = useRef(MIDDLE_C);
  const heldKeys = useRef<Set<string>>(new Set());

  // Keep local "active" in sync with the shared note bus (covers MIDI + mic).
  useEffect(() => {
    const refresh = () => setActive(new Set(noteBus.active.keys()));
    const off1 = noteBus.onNoteOn(refresh);
    const off2 = noteBus.onNoteOff(refresh);
    refresh();
    return () => {
      off1();
      off2();
    };
  }, []);

  const press = (midi: number) => {
    void initAudio();
    if (noteBus.active.has(midi)) return;
    noteBus.noteOn(midi, 0.8, "screen");
  };
  const release = (midi: number) => {
    if (noteBus.active.get(midi) === "screen") noteBus.noteOff(midi, "screen");
  };

  // Computer keyboard support.
  useEffect(() => {
    if (!computerKeys) return;
    const isTyping = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement)?.isContentEditable
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.repeat || isTyping() || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        baseOctaveRef.current = Math.max(24, baseOctaveRef.current - 12);
        return;
      }
      if (k === "x") {
        baseOctaveRef.current = Math.min(96, baseOctaveRef.current + 12);
        return;
      }
      if (k in KEY_MAP && !heldKeys.current.has(k)) {
        heldKeys.current.add(k);
        press(baseOctaveRef.current + KEY_MAP[k]);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in KEY_MAP && heldKeys.current.has(k)) {
        heldKeys.current.delete(k);
        release(baseOctaveRef.current + KEY_MAP[k]);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [computerKeys]);

  const layout = useMemo(() => {
    const whites: number[] = [];
    for (let m = lowMidi; m <= highMidi; m++) {
      if (!isBlackKey(m)) whites.push(m);
    }
    const whiteW = 100 / whites.length;
    const whiteIndex = new Map<number, number>();
    whites.forEach((m, i) => whiteIndex.set(m, i));

    const blacks: { midi: number; left: number; width: number }[] = [];
    for (let m = lowMidi; m <= highMidi; m++) {
      if (isBlackKey(m)) {
        const belowIdx = whiteIndex.get(m - 1);
        if (belowIdx === undefined) continue;
        const width = whiteW * 0.62;
        const left = (belowIdx + 1) * whiteW - width / 2;
        blacks.push({ midi: m, left, width });
      }
    }
    return { whites, whiteW, blacks };
  }, [lowMidi, highMidi]);

  const classFor = (midi: number, black: boolean) => {
    const cls = ["key"];
    if (black) cls.push("black");
    if (active.has(midi)) cls.push("active");
    if (hintMidis.includes(midi)) cls.push("hint");
    if (feedback[midi]) cls.push(feedback[midi]);
    return cls.join(" ");
  };

  const label = (midi: number) => {
    if (!showKeyLabels) return "";
    // Always label every C; otherwise only when labels are on.
    const isC = midi % 12 === 0;
    if (isC) return midiToName(midi, useFlats);
    return midiToPitchClassName(midi, useFlats);
  };

  return (
    <div className="piano">
      <div className="piano-keys">
        {layout.whites.map((midi) => (
          <div
            key={midi}
            className={classFor(midi, false)}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              press(midi);
            }}
            onPointerUp={() => release(midi)}
            onPointerLeave={(e) => {
              if (e.buttons) release(midi);
            }}
            onPointerCancel={() => release(midi)}
          >
            {label(midi)}
          </div>
        ))}
      </div>
      {layout.blacks.map(({ midi, left, width }) => (
        <div
          key={midi}
          className={classFor(midi, true)}
          style={{ left: `${left}%`, width: `${width}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            press(midi);
          }}
          onPointerUp={() => release(midi)}
          onPointerLeave={(e) => {
            if (e.buttons) release(midi);
          }}
          onPointerCancel={() => release(midi)}
        >
          {showKeyLabels ? midiToPitchClassName(midi, useFlats) : ""}
        </div>
      ))}
    </div>
  );
}
