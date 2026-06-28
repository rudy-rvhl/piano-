// Import a .mid / .midi file and convert it to MusicXML so it flows through the
// exact same interactive pipeline as uploaded MusicXML (OSMD rendering +
// wait-mode practice). MIDI is machine-readable, so unlike PDF it can be made
// fully interactive.
//
// Notes are split into a right hand (>= middle C, treble) and left hand
// (< middle C, bass) and rendered as a piano grand staff, so two-hand pieces
// keep both hands. The conversion quantises onsets/durations to a 16th grid,
// groups simultaneous notes into chords, fills gaps with rests, and splits
// notes that cross barlines into tied pieces.

import { Midi } from "@tonejs/midi";

const GRID = 0.25; // quantise to 16th notes (in quarter-note beats)
const DIVISIONS = 4; // MusicXML duration units per quarter note
const SPLIT = 60; // middle C: >= -> right hand, < -> left hand

interface Piece {
  beats: number;
  type: string;
  dots: number;
}

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

interface RawNote {
  midi: number;
  start: number;
  dur: number;
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

function voiceTag(voice?: number): string {
  return voice ? `<voice>${voice}</voice>` : "";
}

function staffTag(staff?: number): string {
  return staff ? `<staff>${staff}</staff>` : "";
}

function noteXml(
  midi: number,
  piece: Piece,
  isChord: boolean,
  tieStart: boolean,
  tieStop: boolean,
  staff?: number,
  voice?: number,
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
  }<octave>${octave}</octave></pitch><duration>${dur}</duration>${tie}${voiceTag(voice)}<type>${piece.type}</type>${dots}${
    alter ? "<accidental>sharp</accidental>" : ""
  }${staffTag(staff)}${tied}</note>`;
}

function restXml(piece: Piece, staff?: number, voice?: number): string {
  const dur = Math.round(piece.beats * DIVISIONS);
  return `      <note><rest/><duration>${dur}</duration>${voiceTag(voice)}<type>${piece.type}</type>${"<dot/>".repeat(piece.dots)}${staffTag(
    staff,
  )}</note>`;
}

function measureRestXml(
  capacity: number,
  staff?: number,
  voice?: number,
): string {
  return `      <note><rest measure="yes"/><duration>${Math.round(
    capacity * DIVISIONS,
  )}</duration>${voiceTag(voice)}${staffTag(staff)}</note>`;
}

const sumBeats = (events: Event[]) =>
  events.reduce((a, e) => a + e.beats, 0);

/** Tile a set of notes into chords + rests across the timeline. */
function buildEvents(notes: RawNote[]): Event[] {
  const byOnset = new Map<number, Set<number>>();
  const durByOnset = new Map<number, number>();
  for (const n of notes) {
    if (!byOnset.has(n.start)) byOnset.set(n.start, new Set());
    byOnset.get(n.start)!.add(n.midi);
    durByOnset.set(n.start, Math.max(durByOnset.get(n.start) ?? 0, n.dur));
  }
  const onsets = [...byOnset.keys()].sort((a, b) => a - b);
  const events: Event[] = [];
  if (onsets.length && onsets[0] > 0) {
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
  return events;
}

function padEvents(events: Event[], targetBeats: number): void {
  const gap = snap(targetBeats - sumBeats(events));
  if (gap > 1e-9) events.push({ midis: [], beats: gap, isRest: true });
}

/** Build per-measure note XML for one voice/staff. */
function buildMeasures(
  events: Event[],
  capacity: number,
  staff?: number,
  voice?: number,
): string[][] {
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
          measures[mi].push(restXml(pc, staff, voice));
        } else {
          ev.midis.forEach((m, ci) => {
            measures[mi].push(
              noteXml(m, pc, ci > 0, willHaveMore, !firstPiece, staff, voice),
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
  return measures;
}

interface AssembleOpts {
  beatsPerMeasure: number;
  beatType: number;
  tempo: number;
  title: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function docWrap(measureXml: string, title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>${escapeXml(title)}</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
${measureXml}
  </part>
</score-partwise>`;
}

function tempoDirection(tempo: number): string {
  return `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type></direction>\n`;
}

function assembleSingle(
  measures: string[][],
  clef: "treble" | "bass",
  opts: AssembleOpts,
): string {
  const capacity = opts.beatsPerMeasure * (4 / opts.beatType);
  const clefXml =
    clef === "treble"
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
${tempoDirection(opts.tempo)}`
          : "";
      const body = notes.length
        ? notes.join("\n")
        : `      <note><rest measure="yes"/><duration>${Math.round(
            capacity * DIVISIONS,
          )}</duration></note>`;
      return `    <measure number="${i + 1}">
${attrs}${body}
    </measure>`;
    })
    .join("\n");
  return docWrap(measureXml, opts.title);
}

function assembleGrand(
  rm: string[][],
  lm: string[][],
  opts: AssembleOpts,
): string {
  const capacity = opts.beatsPerMeasure * (4 / opts.beatType);
  const backupDur = Math.round(capacity * DIVISIONS);
  const count = Math.max(rm.length, lm.length, 1);
  const measureXml = Array.from({ length: count }, (_unused, i) => {
    const attrs =
      i === 0
        ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>${opts.beatsPerMeasure}</beats><beat-type>${opts.beatType}</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
${tempoDirection(opts.tempo)}`
        : "";
    const right = rm[i]?.length
      ? rm[i].join("\n")
      : measureRestXml(capacity, 1, 1);
    const left = lm[i]?.length
      ? lm[i].join("\n")
      : measureRestXml(capacity, 2, 2);
    return `    <measure number="${i + 1}">
${attrs}${right}
      <backup><duration>${backupDur}</duration></backup>
${left}
    </measure>`;
  }).join("\n");
  return docWrap(measureXml, opts.title);
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
  const capacity = beatsPerMeasure * (4 / beatType);

  const raw: RawNote[] = [];
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

  const title =
    (midi.name && midi.name.trim()) ||
    file.name.replace(/\.midi?$/i, "").replace(/_/g, " ");
  const opts: AssembleOpts = { beatsPerMeasure, beatType, tempo, title };

  const right = raw.filter((n) => n.midi >= SPLIT);
  const left = raw.filter((n) => n.midi < SPLIT);

  // Two hands -> grand staff.
  if (right.length && left.length) {
    const rEvents = buildEvents(right);
    const lEvents = buildEvents(left);
    const target = Math.max(sumBeats(rEvents), sumBeats(lEvents));
    const measureCount = Math.max(1, Math.ceil(target / capacity - 1e-9));
    const fill = measureCount * capacity;
    padEvents(rEvents, fill);
    padEvents(lEvents, fill);
    const rm = buildMeasures(rEvents, capacity, 1, 1);
    const lm = buildMeasures(lEvents, capacity, 2, 2);
    return { title, xml: assembleGrand(rm, lm, opts) };
  }

  // Single staff (melody-only).
  const notes = right.length ? right : left;
  const sorted = notes.map((n) => n.midi).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const clef: "treble" | "bass" = median >= SPLIT ? "treble" : "bass";
  const measures = buildMeasures(buildEvents(notes), capacity);
  return { title, xml: assembleSingle(measures, clef, opts) };
}
