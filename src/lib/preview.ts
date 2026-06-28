// Hover preview: play a short (~5s) extract of a piece, synthesised from its
// own notes — no audio files needed. Parses the top staff (right-hand melody)
// out of the MusicXML and schedules it through the Tone.js piano.

import { initAudio, playChord } from "./audio";

interface PreviewEvent {
  midis: number[]; // empty = rest
  beats: number;
}

const STEP_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function pitchToMidi(step: string, alter: number, octave: number): number {
  return (octave + 1) * 12 + (STEP_SEMITONE[step.toUpperCase()] ?? 0) + alter;
}

/** Parse the right-hand (top staff) melody as a list of timed events. */
export function parseMelody(xml: string): PreviewEvent[] {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return [];
    const part = doc.getElementsByTagName("part")[0];
    if (!part) return [];

    const events: PreviewEvent[] = [];
    let divisions = 1;
    const measures = Array.from(part.getElementsByTagName("measure"));
    for (const measure of measures) {
      for (const child of Array.from(measure.children)) {
        const tag = child.tagName.toLowerCase();
        if (tag === "attributes") {
          const d = child.getElementsByTagName("divisions")[0];
          if (d?.textContent) divisions = parseInt(d.textContent, 10) || divisions;
        } else if (tag === "note") {
          const staffEl = child.getElementsByTagName("staff")[0];
          const staff = staffEl ? parseInt(staffEl.textContent || "1", 10) : 1;
          if (staff === 2) continue; // skip left hand for the melody preview
          const durEl = child.getElementsByTagName("duration")[0];
          const dur = durEl ? parseInt(durEl.textContent || "0", 10) : 0;
          const beats = divisions ? dur / divisions : 0;
          const isChord = child.getElementsByTagName("chord").length > 0;
          if (child.getElementsByTagName("rest").length) {
            events.push({ midis: [], beats });
            continue;
          }
          const pitch = child.getElementsByTagName("pitch")[0];
          if (!pitch) continue;
          const step = pitch.getElementsByTagName("step")[0]?.textContent || "C";
          const alterEl = pitch.getElementsByTagName("alter")[0];
          const alter = alterEl ? parseInt(alterEl.textContent || "0", 10) : 0;
          const octave = parseInt(
            pitch.getElementsByTagName("octave")[0]?.textContent || "4",
            10,
          );
          const midi = pitchToMidi(step, alter, octave);
          if (isChord && events.length) {
            const last = events[events.length - 1];
            if (last.midis.length) {
              last.midis.push(midi);
              continue;
            }
          }
          events.push({ midis: [midi], beats });
        }
      }
    }
    return events;
  } catch {
    return [];
  }
}

function parseTempo(xml: string): number {
  const m = xml.match(/<per-minute>(\d+(?:\.\d+)?)<\/per-minute>/);
  const t = m ? parseFloat(m[1]) : 90;
  return Math.max(40, Math.min(220, t || 90));
}

let stopCurrent: (() => void) | null = null;

/** Stop any in-progress preview. */
export function stopPreview(): void {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Start a ~maxSeconds preview of the piece. Returns true if it found notes and
 * began playing.
 */
export function startPreview(
  xml: string,
  opts: { maxSeconds?: number; onEnd?: () => void } = {},
): boolean {
  stopPreview();
  void initAudio();

  const maxSeconds = opts.maxSeconds ?? 5;
  let events = parseMelody(xml);
  // Drop leading rests so the preview starts on a note.
  while (events.length && events[0].midis.length === 0) events.shift();
  if (!events.length) return false;

  const secPerBeat = 60 / parseTempo(xml);
  let cancelled = false;
  let i = 0;
  let elapsed = 0;
  let timer: number | undefined;

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    if (timer) window.clearTimeout(timer);
    if (stopCurrent === stop) stopCurrent = null;
    opts.onEnd?.();
  };

  const stop = () => {
    cancelled = true;
    if (timer) window.clearTimeout(timer);
  };

  const tick = () => {
    if (cancelled) return;
    if (i >= events.length || elapsed >= maxSeconds) {
      finish();
      return;
    }
    const ev = events[i++];
    const durSec = Math.max(0.14, ev.beats * secPerBeat);
    if (ev.midis.length) {
      playChord(ev.midis, Math.min(durSec * 0.95, 1.3), 0.7);
    }
    elapsed += durSec;
    timer = window.setTimeout(tick, Math.max(120, durSec * 1000));
  };

  stopCurrent = stop;
  tick();
  return true;
}
