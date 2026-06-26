// A tiny typed event bus that unifies every note source (on-screen keyboard,
// MIDI hardware, microphone pitch detection) into a single stream of note-on /
// note-off events. The practice engine and the reading trainer subscribe here
// instead of caring where a note came from.

export type NoteSource = "screen" | "midi" | "mic";

export interface NoteEvent {
  midi: number;
  velocity: number; // 0..1
  source: NoteSource;
}

type Handler = (e: NoteEvent) => void;

class NoteBus {
  private onHandlers = new Set<Handler>();
  private offHandlers = new Set<Handler>();
  /** Currently held notes -> the source that triggered them. */
  readonly active = new Map<number, NoteSource>();

  onNoteOn(h: Handler): () => void {
    this.onHandlers.add(h);
    return () => this.onHandlers.delete(h);
  }

  onNoteOff(h: Handler): () => void {
    this.offHandlers.add(h);
    return () => this.offHandlers.delete(h);
  }

  noteOn(midi: number, velocity = 0.75, source: NoteSource = "screen") {
    this.active.set(midi, source);
    const e: NoteEvent = { midi, velocity, source };
    this.onHandlers.forEach((h) => h(e));
  }

  noteOff(midi: number, source: NoteSource = "screen") {
    this.active.delete(midi);
    const e: NoteEvent = { midi, velocity: 0, source };
    this.offHandlers.forEach((h) => h(e));
  }

  /** Release everything (e.g. when switching pages or losing focus). */
  panic() {
    for (const midi of [...this.active.keys()]) {
      this.noteOff(midi);
    }
  }
}

export const noteBus = new NoteBus();
