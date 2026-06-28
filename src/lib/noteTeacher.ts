// Helpers that "explain and teach the notes on the music sheet":
//  1. annotateMusicXml() injects note-name lyrics under each note so OSMD draws
//     the names right on the staff (letters A–G or solfège do–ré–mi).
//  2. describeNote() produces a plain-language lesson for a single note — where
//     it sits on the staff, its names in English + French, and a mnemonic.

import { type Clef, midiToName, midiToPitchClassName, staffPlacement } from "./notes";
import type { NoteLabelMode } from "../store/useSettings";

const SOLFEGE: Record<string, string> = {
  C: "do",
  D: "ré",
  E: "mi",
  F: "fa",
  G: "sol",
  A: "la",
  B: "si",
};

export function labelForStep(
  step: string,
  alter: number,
  mode: NoteLabelMode,
): string {
  const base =
    mode === "solfege"
      ? SOLFEGE[step.toUpperCase()] ?? step
      : step.toUpperCase();
  const acc = alter > 0 ? "#".repeat(alter) : alter < 0 ? "b".repeat(-alter) : "";
  return base + acc;
}

/**
 * Return a copy of the MusicXML with a <lyric> note name under every note, so
 * OSMD renders the names directly on the sheet. Falls back to the original
 * string if anything goes wrong.
 */
export function annotateMusicXml(xml: string, mode: NoteLabelMode): string {
  if (mode === "off") return xml;
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return xml;
    const notes = Array.from(doc.getElementsByTagName("note"));
    for (const note of notes) {
      if (note.getElementsByTagName("rest").length) continue;
      if (note.getElementsByTagName("chord").length) continue; // skip chord members
      const pitch = note.getElementsByTagName("pitch")[0];
      if (!pitch) continue;
      const step = pitch.getElementsByTagName("step")[0]?.textContent ?? "";
      if (!step) continue;
      const alterText = pitch.getElementsByTagName("alter")[0]?.textContent;
      const alter = alterText ? parseInt(alterText, 10) : 0;

      Array.from(note.getElementsByTagName("lyric")).forEach((l) =>
        note.removeChild(l),
      );
      const lyric = doc.createElement("lyric");
      const syllabic = doc.createElement("syllabic");
      syllabic.textContent = "single";
      const text = doc.createElement("text");
      text.textContent = labelForStep(step, alter, mode);
      lyric.appendChild(syllabic);
      lyric.appendChild(text);
      note.appendChild(lyric);
    }
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return xml;
  }
}

export interface NoteLesson {
  letter: string; // e.g. "C" or "C#"
  solfege: string; // e.g. "do" or "do#"
  octave: number;
  english: string; // e.g. "C4"
  position: string; // where it sits on the staff
  mnemonic: string; // memory aid
  isMiddleC: boolean;
}

export function describeNote(
  midi: number,
  clef: Clef,
  useFlats = false,
): NoteLesson {
  const english = midiToName(midi, useFlats);
  const pc = midiToPitchClassName(midi, useFlats);
  const letter = pc[0];
  const accidental = pc.slice(1);
  const solfege = (SOLFEGE[letter] ?? letter) + accidental;
  const octave = Math.floor(midi / 12) - 1;
  const { step } = staffPlacement(midi, clef);
  const onLine = (((step % 2) + 2) % 2) === 0;
  const isMiddleC = midi === 60;

  let position: string;
  if (isMiddleC) {
    position =
      clef === "treble"
        ? "on a short ledger line just below the treble staff — this is middle C"
        : "on a short ledger line just above the bass staff — this is middle C";
  } else if (step >= -4 && step <= 4) {
    if (step === 0) {
      position = `on the middle line of the ${clef} staff`;
    } else if (onLine) {
      const lineNum = step / 2 + 3;
      position = `on line ${lineNum} of the ${clef} staff (counting from the bottom)`;
    } else {
      const spaceNum = (step + 5) / 2;
      position = `in space ${spaceNum} of the ${clef} staff`;
    }
  } else {
    const ledgerCount = Math.ceil((Math.abs(step) - 4) / 2);
    const dir = step > 0 ? "above" : "below";
    position = `${ledgerCount} ledger line${
      ledgerCount > 1 ? "s" : ""
    } ${dir} the ${clef} staff`;
  }

  let mnemonic: string;
  if (clef === "treble") {
    mnemonic = onLine
      ? "Treble lines (bottom→top): E · G · B · D · F — “Every Good Boy Does Fine”."
      : "Treble spaces (bottom→top): F · A · C · E — they spell “FACE”.";
  } else {
    mnemonic = onLine
      ? "Bass lines (bottom→top): G · B · D · F · A — “Good Boys Do Fine Always”."
      : "Bass spaces (bottom→top): A · C · E · G — “All Cows Eat Grass”.";
  }

  return { letter, solfege, octave, english, position, mnemonic, isMiddleC };
}
