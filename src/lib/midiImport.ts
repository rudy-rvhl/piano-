// Import a .mid / .midi file and convert it to MusicXML so it flows through the
// exact same interactive pipeline as uploaded MusicXML (OSMD rendering +
// wait-mode practice). MIDI is machine-readable, so unlike PDF it can be made
// fully interactive.
//
// The conversion quantises note onsets/durations to a 16th-note grid, groups
// simultaneous notes into chords, fills gaps with rests, and splits notes that
// cross barlines into tied pieces — enough to produce clean, playable notation
// from typical MIDI without a full notation engine.

import { Midi } from "@tonejs/midi";

const GRID = 0.25; // quantise to 16th notes (in quarter-note beats)
const DIVISIONS = 4; // MusicXML duration units per quarter note

interface Piece {
  beats: number;
  type: string;
  dots: number;
}

// Standard note values, largest first, for greedy duration decomposition.
const DURATIONS: Piece[] = [
  { beats: 4, type: "whole", dots: 0 },
  { beats: 3, type: "half", dots: 1 },
  { beats: 2, type: "half", dots: 0 },
  { beats: 1.5, type: "quarter", dots: 1 },
  { beats: 1, type: "quarter", dots: 0 },
  { beats: 0.75, type: "eighth", dots: 1 },
  { beats: 0.5, type: "eighth", dots: 0 },
  { beats: 0.25, type: "16th", dots: 0 },
];

const SHARP_SPELLING: { step: string; alter: number }[] = [
  { step: "C", alter: 0 },
  { step: "C", alter: 1 },
  { step: "D", alter: 0 },
  { step: "D", alter: 1 },
  { step: "E", alter: 0 },
  { step: "F", alter: 0 },
  { step: "F", alter: 1 },
  { step: "G", alter: 0 },
  { step: "G", alter: 1 },
  { step: "A", alter: 0 },
  { step: "A", alter: 1 },
  { step: "B", alter: 0 },
];

interface Event {
  midis: number[]; // empty = rest
  beats: number;
  isRest: boolean;
}

const snap = (x: number) => Math.round(x / GRID) * GRID;

function decompose(total: number): Piece[] {
  const out: Piece[] = [];
  let r = snap(total);
  for (const d of DURATIONS) {
    while (r >= d.beats - 1e-9) {
      out.push(d);
      r = snap(r - d.beats);
    }
  }
  return out;
}

function midiToStepOctave(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  const { step, alter } = SHARP_SPELLING[pc];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

function noteXml(
  midi: number,
  piece: Piece,
  isChord: boolean,
  tieStart: boolean,
  tieStop: boolean,
): string {
  const { step, alter, octave } = midiToStepOctave(midi);
  const dur = Math.round(piece.beats * DIVISIONS);
  const dots = "<dot/>".repeat(piece.dots);
  const tie =
    (tieStop ? '<tie type="stop"/>' : "") +
    (tieStart ? '<tie type="start"/>' : "");
  const tied =
    tieStart || tieStop
      ? `<notations>${tieStop ? '<tied type="stop"/>' : ""}${
          tieStart ? '<tied type="start"/>' : ""
        }</notations>`
      : "";
  return `      <note>${isChord ? "<chord/>" : ""}<pitch><step>${step}</step>${
    alter ? `<alter>${alter}</alter>` : ""
  }<octave>${octave}</octave></pitch>${tie}<duration>${dur}</duration><type>${
    piece.type
  }</type>${dots}${alter ? "<accidental>sharp</accidental>" : ""}${tied}</note>`;
}

function restXml(piece: Piece): string {
  const dur = Math.round(piece.beats * DIVISIONS);
  return `      <note><rest/><duration>${dur}</duration><type>${
    piece.type
  }</type>${"<dot/>".repeat(piece.dots)}</note>`;
}

function eventsToMusicXml(
  events: Event[],
  opts: {
    beatsPerMeasure: number;
    beatType: number;
    clef: "treble" | "bass";
    tempo: number;
    title: string;
  },
): string {
  const capacity = opts.beatsPerMeasure * (4 / opts.beatType);
  const measures: string[][] = [[]];
  let mi = 0;
  let pos = 0;
  const newMeasure = () => {
    measures.push([]);
    mi++;
    pos = 0;
  };

  for (const ev of events) {
    let remaining = snap(ev.beats);
    let firstPiece = true;
    while (remaining > 1e-9) {
      const capLeft = capacity - pos;
      const take = Math.min(remaining, capLeft);
      const pieces = decompose(take);
      pieces.forEach((pc, pIdx) => {
        const willHaveMore =
          pIdx < pieces.length - 1 || snap(remaining - take) > 1e-9;
        if (ev.isRest) {
          measures[mi].push(restXml(pc));
        } else {
          ev.midis.forEach((m, ci) => {
            measures[mi].push(
              noteXml(m, pc, ci > 0, willHaveMore, !firstPiece),
            );
          });
        }
        firstPiece = false;
        pos = snap(pos + pc.beats);
        if (pos >= capacity - 1e-9) newMeasure();
      });
      remaining = snap(remaining - take);
    }
  }

  if (measures.length > 1 && measures[measures.length - 1].length === 0) {
    measures.pop();
  }

  const clefXml =
    opts.clef === "treble"
      ? "<sign>G</sign><line>2</line>"
      : "<sign>F</sign><line>4</line>";

  const measureXml = measures
    .map((notes, i) => {
      const attrs =
        i === 0
          ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>${opts.beatsPerMeasure}</beats><beat-type>${opts.beatType}</beat-type></time>
        <clef>${clefXml}</clef>
      </attributes>
      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${opts.tempo}</per-minute></metronome></direction-type></direction>\n`
          : "";
      const body = notes.length
        ? notes.join("\n")
        : `      <note><rest measure="yes"/><duration>${Math.round(
            capacity * DIVISIONS,
          )}</duration></note>`;
      return `    <measure number="${i + 1}">\n${attrs}${body}\n    </measure>`;
    })
    .join("\n");

  const safeTitle = opts.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>${safeTitle}</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measureXml}
  </part>
</score-partwise>`;
}

export interface MidiImportResult {
  title: string;
  xml: string;
}

export async function importMidiFile(file: File): Promise<MidiImportResult> {
  const buf = await file.arrayBuffer();
  const midi = new Midi(buf);
  const ppq = midi.header.ppq || 480;
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const beatsPerMeasure = ts[0] ?? 4;
  const beatType = ts[1] ?? 4;
  const tempo = Math.round(midi.header.tempos[0]?.bpm ?? 100) || 100;

  // Collect notes from all pitched (non-percussion) tracks.
  const raw: { midi: number; start: number; dur: number }[] = [];
  for (const track of midi.tracks) {
    if (track.instrument?.percussion) continue;
    for (const n of track.notes) {
      raw.push({
        midi: n.midi,
        start: snap(n.ticks / ppq),
        dur: Math.max(GRID, snap(n.durationTicks / ppq)),
      });
    }
  }
  if (!raw.length) {
    throw new Error("No playable notes found in this MIDI file.");
  }

  // Group simultaneous notes (same onset) into chords.
  const byOnset = new Map<number, Set<number>>();
  const durByOnset = new Map<number, number>();
  for (const n of raw) {
    if (!byOnset.has(n.start)) byOnset.set(n.start, new Set());
    byOnset.get(n.start)!.add(n.midi);
    durByOnset.set(n.start, Math.max(durByOnset.get(n.start) ?? 0, n.dur));
  }
  const onsets = [...byOnset.keys()].sort((a, b) => a - b);

  // Tile the timeline with chords + rests.
  const events: Event[] = [];
  if (onsets[0] > 0) {
    events.push({ midis: [], beats: onsets[0], isRest: true });
  }
  for (let i = 0; i < onsets.length; i++) {
    const on = onsets[i];
    const next = onsets[i + 1];
    const maxDur = durByOnset.get(on)!;
    const seg = next != null ? snap(next - on) : maxDur;
    const chordDur = Math.max(GRID, Math.min(maxDur, seg));
    events.push({
      midis: [...byOnset.get(on)!].sort((a, b) => a - b),
      beats: chordDur,
      isRest: false,
    });
    const gap = snap(seg - chordDur);
    if (gap > 1e-9) events.push({ midis: [], beats: gap, isRest: true });
  }

  // Clef by median pitch.
  const sorted = raw.map((n) => n.midi).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const clef: "treble" | "bass" = median >= 60 ? "treble" : "bass";

  const title =
    (midi.name && midi.name.trim()) ||
    file.name.replace(/\.midi?$/i, "").replace(/_/g, " ");

  const xml = eventsToMusicXml(events, {
    beatsPerMeasure,
    beatType,
    clef,
    tempo,
    title,
  });
  return { title, xml };
}
