// Wraps OpenSheetMusicDisplay: renders MusicXML, walks the score to build a
// flat list of "steps" (each onset and the notes that sound there), and drives
// the follow-along cursor used by both practice mode and playback.
//
// OSMD pitch note: `Pitch.halfTone` counts semitones from C0 (so middle C / C4
// = 48). MIDI puts middle C at 60, hence the +12 offset. This is verified by a
// calibration probe in the test suite.

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export const OSMD_HALFTONE_TO_MIDI = 12;

export type Hand = "both" | "right" | "left";

export interface PracticeStep {
  /** Sounding MIDI notes at this onset, ascending. Empty when it's a rest. */
  midis: number[];
  /** Notes on the top staff (right hand). */
  rightMidis: number[];
  /** Notes on the lower staff/staves (left hand). */
  leftMidis: number[];
  isRest: boolean;
  /** Onset duration in quarter-note beats. */
  durationBeats: number;
  /** 1-based measure number for display. */
  measure: number;
}

/** Notes for a step restricted to the selected hand. */
export function stepHandMidis(step: PracticeStep, hand: Hand): number[] {
  if (hand === "right") return step.rightMidis;
  if (hand === "left") return step.leftMidis;
  return step.midis;
}

export class ScoreEngine {
  readonly osmd: OpenSheetMusicDisplay;
  steps: PracticeStep[] = [];
  tempo = 90;
  private stepIndex = 0;

  constructor(container: HTMLElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawingParameters: "default",
      followCursor: true,
      cursorsOptions: [{ type: 0, color: "#5b8cff", alpha: 0.45, follow: true }],
    });
  }

  async load(xml: string): Promise<void> {
    await this.osmd.load(xml);
    this.osmd.render();
    this.readTempo();
    this.steps = this.buildSteps();
    this.resetCursor();
  }

  render() {
    this.osmd.render();
  }

  private readTempo() {
    try {
      const sheet = this.osmd.Sheet as unknown as {
        DefaultStartTempoInBpm?: number;
        userStartTempoInBPM?: number;
      };
      this.tempo =
        sheet.userStartTempoInBPM || sheet.DefaultStartTempoInBpm || 90;
      if (!this.tempo || this.tempo < 20) this.tempo = 90;
    } catch {
      this.tempo = 90;
    }
  }

  /** Convert an OSMD note to { midi, staff }; staff 0 = top staff (right hand). */
  private noteInfo(note: unknown): { midi: number; staff: number } | null {
    const n = note as {
      isRest?: () => boolean;
      Pitch?: { halfTone?: number };
      ParentStaffEntry?: { ParentStaff?: { idInMusicSheet?: number } };
    };
    try {
      if (typeof n.isRest === "function" && n.isRest()) return null;
      if (!n.Pitch || typeof n.Pitch.halfTone !== "number") return null;
      const staff = n.ParentStaffEntry?.ParentStaff?.idInMusicSheet;
      return {
        midi: n.Pitch.halfTone + OSMD_HALFTONE_TO_MIDI,
        staff: typeof staff === "number" ? staff : 0,
      };
    } catch {
      return null;
    }
  }

  /** Walk the whole score with a fresh iterator and capture each onset. */
  private buildSteps(): PracticeStep[] {
    const steps: PracticeStep[] = [];
    const cursor = this.osmd.cursor;
    cursor.reset();
    let guard = 0;
    while (!cursor.Iterator.EndReached && guard < 100000) {
      guard++;
      const notes = (cursor.NotesUnderCursor() ?? []) as unknown[];
      const midis: number[] = [];
      const rightMidis: number[] = [];
      const leftMidis: number[] = [];
      let durationBeats = 1;
      let measure = 1;
      for (const note of notes) {
        const info = this.noteInfo(note);
        const len = (note as { Length?: { RealValue?: number } }).Length;
        if (len && typeof len.RealValue === "number") {
          durationBeats = Math.max(durationBeats, len.RealValue * 4);
        }
        if (info) {
          midis.push(info.midi);
          if (info.staff === 0) rightMidis.push(info.midi);
          else leftMidis.push(info.midi);
        }
      }
      try {
        const ts = cursor.Iterator.CurrentMeasure?.MeasureNumber;
        if (typeof ts === "number") measure = ts;
      } catch {
        /* ignore */
      }
      const asc = (a: number, b: number) => a - b;
      midis.sort(asc);
      rightMidis.sort(asc);
      leftMidis.sort(asc);
      steps.push({
        midis,
        rightMidis,
        leftMidis,
        isRest: midis.length === 0,
        durationBeats: clampDuration(durationBeats),
        measure,
      });
      cursor.next();
    }
    return steps;
  }

  // --- live cursor control (practice + playback) ---------------------------

  resetCursor() {
    this.stepIndex = 0;
    this.osmd.cursor.reset();
    this.osmd.cursor.show();
  }

  showCursor() {
    this.osmd.cursor.show();
  }

  hideCursor() {
    this.osmd.cursor.hide();
  }

  next(): boolean {
    if (this.atEnd()) return false;
    this.osmd.cursor.next();
    this.stepIndex++;
    return !this.atEnd();
  }

  atEnd(): boolean {
    return this.osmd.cursor.Iterator.EndReached;
  }

  get index(): number {
    return this.stepIndex;
  }

  get total(): number {
    return this.steps.length;
  }

  get current(): PracticeStep | undefined {
    return this.steps[this.stepIndex];
  }

  /** Notes the player must currently produce, read live from the cursor. */
  expectedMidis(hand: Hand = "both"): number[] {
    const notes = (this.osmd.cursor.NotesUnderCursor() ?? []) as unknown[];
    const out: number[] = [];
    for (const note of notes) {
      const info = this.noteInfo(note);
      if (!info) continue;
      const isRight = info.staff === 0;
      if (hand === "right" && !isRight) continue;
      if (hand === "left" && isRight) continue;
      out.push(info.midi);
    }
    return out.sort((a, b) => a - b);
  }

  /** True when the piece has a separate left-hand (lower) staff. */
  get hasLeftHand(): boolean {
    return this.steps.some((s) => s.leftMidis.length > 0);
  }

  /** Total practice notes (excludes rests), for accuracy/progress maths. */
  get noteCount(): number {
    return this.steps.reduce((sum, s) => sum + (s.isRest ? 0 : 1), 0);
  }

  dispose() {
    try {
      this.osmd.clear();
    } catch {
      /* ignore */
    }
  }
}

function clampDuration(beats: number): number {
  if (!isFinite(beats) || beats <= 0) return 1;
  return Math.min(beats, 8);
}
