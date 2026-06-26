// Core music-theory helpers shared across the app.
// MIDI convention: middle C (C4) = 60, A4 = 69 (440 Hz).

export type Clef = "treble" | "bass";

export const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

// Letter -> semitone offset within an octave (natural notes only).
const LETTER_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Letter -> diatonic step index within an octave (used for staff placement).
const LETTER_DIATONIC: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** Convert a step letter + octave + alteration into a MIDI note number. */
export function noteToMidi(step: string, octave: number, alter = 0): number {
  const base = LETTER_SEMITONE[step.toUpperCase()] ?? 0;
  return (octave + 1) * 12 + base + alter;
}

/** Human-readable note name for a MIDI number, e.g. 60 -> "C4". */
export function midiToName(midi: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const name = names[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Note name without the octave, e.g. 61 -> "C#". */
export function midiToPitchClassName(midi: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[((midi % 12) + 12) % 12];
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

/** Frequency in Hz for a MIDI note. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Closest MIDI note (float -> rounded) for a frequency. */
export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/** Exact (unrounded) MIDI value for a frequency — useful for tuning displays. */
export function freqToMidiExact(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export interface StaffPlacement {
  /** Diatonic step relative to the clef reference (middle line = 0). */
  step: number;
  /** Number of ledger lines needed; sign indicates above (+) / below (-). */
  ledger: number;
  /** "sharp" | "flat" | null — accidental to draw for this spelling. */
  accidental: "sharp" | "flat" | null;
}

// Diatonic index = octave * 7 + letterDiatonic. A higher index sits higher.
function diatonicIndex(letter: string, octave: number): number {
  return octave * 7 + (LETTER_DIATONIC[letter.toUpperCase()] ?? 0);
}

// Reference: the MIDDLE line of each staff.
// Treble middle line = B4 (diatonic index 4*7+6 = 34).
// Bass middle line   = D3 (diatonic index 3*7+1 = 22).
const MIDDLE_LINE_INDEX: Record<Clef, number> = {
  treble: diatonicIndex("B", 4),
  bass: diatonicIndex("D", 3),
};

/**
 * Where a MIDI note sits on a given clef. `step` counts diatonic steps from the
 * middle staff line (each line→space is one step). Positive = higher on the page.
 * For black keys we spell them as a sharpened natural (C# -> C with a sharp).
 */
export function staffPlacement(
  midi: number,
  clef: Clef,
  useFlats = false,
): StaffPlacement {
  const pc = ((midi % 12) + 12) % 12;
  let letter: string;
  let accidental: "sharp" | "flat" | null = null;

  if (useFlats) {
    const flat = NOTE_NAMES_FLAT[pc];
    letter = flat[0];
    accidental = flat.length > 1 ? "flat" : null;
  } else {
    const sharp = NOTE_NAMES_SHARP[pc];
    letter = sharp[0];
    accidental = sharp.length > 1 ? "sharp" : null;
  }

  // Octave of the *letter* spelling. For a flat spelling (e.g. Cb / Db) the
  // letter octave matches the MIDI octave for our pitch range, which is fine
  // because we only ever use natural + single accidental here.
  const octave = Math.floor(midi / 12) - 1;
  const idx = diatonicIndex(letter, octave);
  const step = idx - MIDDLE_LINE_INDEX[clef];

  // Ledger lines: the staff spans steps -4..+4 (5 lines). Anything beyond needs
  // ledger lines, one per line position (even steps) outside the staff.
  let ledger = 0;
  if (step > 4) ledger = Math.floor(step / 2) - 2;
  else if (step < -4) ledger = Math.ceil(step / 2) + 2;

  return { step, ledger, accidental };
}

/** Pick the clef that best fits a MIDI note (split at middle C). */
export function bestClef(midi: number): Clef {
  return midi >= 60 ? "treble" : "bass";
}

export const MIN_PIANO_MIDI = 21; // A0
export const MAX_PIANO_MIDI = 108; // C8
export const MIDDLE_C = 60;
