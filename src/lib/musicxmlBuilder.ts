// A small MusicXML generator. We use it to seed the library with public-domain
// melodies from compact note arrays, but it's also a clean reference for the
// exact MusicXML shape the app understands. Single voice, single (treble or
// bass) staff — enough for melodies and exercises.

export interface SimpleNote {
  /** MIDI number, or null for a rest. */
  midi: number | null;
  /** Length in quarter-note beats: 1 = quarter, 0.5 = eighth, 2 = half, etc. */
  beats: number;
}

export interface BuildOptions {
  title: string;
  composer?: string;
  beatsPerMeasure?: number; // numerator of the time signature
  beatType?: number; // denominator
  clef?: "treble" | "bass";
  tempo?: number;
}

const DIVISIONS = 4; // duration units per quarter note

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

// beats -> { type, dots }
function durationType(beats: number): { type: string; dots: number } {
  const table: Record<string, { type: string; dots: number }> = {
    "4": { type: "whole", dots: 0 },
    "3": { type: "half", dots: 1 },
    "2": { type: "half", dots: 0 },
    "1.5": { type: "quarter", dots: 1 },
    "1": { type: "quarter", dots: 0 },
    "0.75": { type: "eighth", dots: 1 },
    "0.5": { type: "eighth", dots: 0 },
    "0.25": { type: "16th", dots: 0 },
  };
  return table[String(beats)] ?? { type: "quarter", dots: 0 };
}

function noteXml(note: SimpleNote): string {
  const dur = Math.round(note.beats * DIVISIONS);
  const { type, dots } = durationType(note.beats);
  const dotXml = "<dot/>".repeat(dots);

  if (note.midi === null) {
    return `      <note>
        <rest/>
        <duration>${dur}</duration>
        <type>${type}</type>
        ${dotXml}
      </note>`;
  }

  const pc = ((note.midi % 12) + 12) % 12;
  const { step, alter } = SHARP_SPELLING[pc];
  const octave = Math.floor(note.midi / 12) - 1;
  const alterXml = alter ? `<alter>${alter}</alter>` : "";
  const accidentalXml = alter ? `<accidental>sharp</accidental>` : "";

  return `      <note>
        <pitch>
          <step>${step}</step>
          ${alterXml}
          <octave>${octave}</octave>
        </pitch>
        <duration>${dur}</duration>
        <type>${type}</type>
        ${dotXml}
        ${accidentalXml}
      </note>`;
}

export function buildMusicXML(
  notes: SimpleNote[],
  opts: BuildOptions,
): string {
  const beatsPerMeasure = opts.beatsPerMeasure ?? 4;
  const beatType = opts.beatType ?? 4;
  const clef = opts.clef ?? "treble";

  // A measure holds `beatsPerMeasure` of the given beat unit, expressed in
  // quarter-note beats (the unit our `beats` field uses).
  const capacity = beatsPerMeasure * (4 / beatType);

  // Group notes into measures by accumulated beats.
  const measures: SimpleNote[][] = [];
  let current: SimpleNote[] = [];
  let acc = 0;
  for (const n of notes) {
    current.push(n);
    acc += n.beats;
    if (acc >= capacity - 1e-6) {
      measures.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length) measures.push(current);

  const clefXml =
    clef === "treble"
      ? "<sign>G</sign><line>2</line>"
      : "<sign>F</sign><line>4</line>";

  const tempoXml = opts.tempo
    ? `      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${opts.tempo}</per-minute></metronome></direction-type>
      </direction>\n`
    : "";

  const measureXml = measures
    .map((m, i) => {
      const attrs =
        i === 0
          ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>${beatsPerMeasure}</beats><beat-type>${beatType}</beat-type></time>
        <clef>${clefXml}</clef>
      </attributes>\n`
          : "";
      const tempoHere = i === 0 ? tempoXml : "";
      return `    <measure number="${i + 1}">
${attrs}${tempoHere}${m.map(noteXml).join("\n")}
    </measure>`;
    })
    .join("\n");

  const workXml = `  <work><work-title>${escapeXml(opts.title)}</work-title></work>`;
  const creatorXml = opts.composer
    ? `  <identification><creator type="composer">${escapeXml(
        opts.composer,
      )}</creator></identification>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
${workXml}
${creatorXml}  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
${measureXml}
  </part>
</score-partwise>`;
}

function splitMeasures(notes: SimpleNote[], capacity: number): SimpleNote[][] {
  const measures: SimpleNote[][] = [];
  let current: SimpleNote[] = [];
  let acc = 0;
  for (const n of notes) {
    current.push(n);
    acc += n.beats;
    if (acc >= capacity - 1e-6) {
      measures.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length) measures.push(current);
  return measures;
}

function noteXmlStaff(note: SimpleNote, staff: number, voice: number): string {
  const dur = Math.round(note.beats * DIVISIONS);
  const { type, dots } = durationType(note.beats);
  const dotXml = "<dot/>".repeat(dots);
  if (note.midi === null) {
    return `      <note><rest/><duration>${dur}</duration><voice>${voice}</voice><type>${type}</type>${dotXml}<staff>${staff}</staff></note>`;
  }
  const pc = ((note.midi % 12) + 12) % 12;
  const { step, alter } = SHARP_SPELLING[pc];
  const octave = Math.floor(note.midi / 12) - 1;
  const alterXml = alter ? `<alter>${alter}</alter>` : "";
  const accidentalXml = alter ? `<accidental>sharp</accidental>` : "";
  return `      <note><pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch><duration>${dur}</duration><voice>${voice}</voice><type>${type}</type>${dotXml}${accidentalXml}<staff>${staff}</staff></note>`;
}

/**
 * Build a piano grand staff (treble = right hand, bass = left hand) from two
 * note arrays. Both hands are split into measures of the same capacity and
 * combined with a <backup> per measure.
 */
export function buildGrandStaffMusicXML(
  right: SimpleNote[],
  left: SimpleNote[],
  opts: BuildOptions,
): string {
  const beatsPerMeasure = opts.beatsPerMeasure ?? 4;
  const beatType = opts.beatType ?? 4;
  const capacity = beatsPerMeasure * (4 / beatType);
  const backupDur = Math.round(capacity * DIVISIONS);

  const rm = splitMeasures(right, capacity);
  const lm = splitMeasures(left, capacity);
  const count = Math.max(rm.length, lm.length, 1);

  const tempoXml = opts.tempo
    ? `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${opts.tempo}</per-minute></metronome></direction-type></direction>\n`
    : "";

  const measureRest = (staff: number, voice: number) =>
    `      <note><rest measure="yes"/><duration>${backupDur}</duration><voice>${voice}</voice><type>whole</type><staff>${staff}</staff></note>`;

  const measureXml = Array.from({ length: count }, (_unused, i) => {
    const attrs =
      i === 0
        ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>${beatsPerMeasure}</beats><beat-type>${beatType}</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>\n`
        : "";
    const tempoHere = i === 0 ? tempoXml : "";
    const rightNotes = (
      rm[i]?.length ? rm[i].map((n) => noteXmlStaff(n, 1, 1)) : [measureRest(1, 1)]
    ).join("\n");
    const leftNotes = (
      lm[i]?.length ? lm[i].map((n) => noteXmlStaff(n, 2, 2)) : [measureRest(2, 2)]
    ).join("\n");
    return `    <measure number="${i + 1}">
${attrs}${tempoHere}${rightNotes}
      <backup><duration>${backupDur}</duration></backup>
${leftNotes}
    </measure>`;
  }).join("\n");

  const workXml = `  <work><work-title>${escapeXml(opts.title)}</work-title></work>`;
  const creatorXml = opts.composer
    ? `  <identification><creator type="composer">${escapeXml(
        opts.composer,
      )}</creator></identification>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
${workXml}
${creatorXml}  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
${measureXml}
  </part>
</score-partwise>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
