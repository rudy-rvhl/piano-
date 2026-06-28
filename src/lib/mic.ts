// Microphone pitch detection for acoustic / digital pianos with no MIDI out.
// Uses pitchy's McLeod pitch method on the live mic signal, smooths the result,
// and emits stable note-on / note-off events into the shared note bus.
//
// Monophonic by nature — it tracks the single strongest pitch — so it's great
// for single-note melodies and the reading trainer, less so for dense chords.

import { PitchDetector } from "pitchy";
import { freqToMidi, freqToMidiExact } from "./notes";
import { noteBus } from "./noteBus";

export interface MicState {
  enabled: boolean;
  error?: string;
  /** Live detected MIDI note (or null), for the tuner readout. */
  liveMidi: number | null;
  /** Cents off from the nearest semitone, -50..+50. */
  cents: number;
  /** 0..1 detection confidence. */
  clarity: number;
}

type Listener = (s: MicState) => void;

const listeners = new Set<Listener>();
let state: MicState = {
  enabled: false,
  liveMidi: null,
  cents: 0,
  clarity: 0,
};

let audioCtx: AudioContext | null = null;
let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let detector: PitchDetector<Float32Array> | null = null;
let buffer: Float32Array<ArrayBuffer> | null = null;
let raf = 0;

// Note-tracking state machine.
let currentNote: number | null = null;
let candidate: number | null = null;
let candidateCount = 0;
let silenceCount = 0;

const CLARITY_THRESHOLD = 0.92;
const MIN_FREQ = 50;
const MAX_FREQ = 2200;
const CONFIRM_FRAMES = 3; // frames a new pitch must persist before note-on
const RELEASE_FRAMES = 6; // frames of silence before note-off

function emit() {
  listeners.forEach((l) => l(state));
}

export function subscribeMic(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function getMicState(): MicState {
  return state;
}

function loop() {
  if (!analyser || !detector || !buffer || !audioCtx) return;
  analyser.getFloatTimeDomainData(buffer);
  const [freq, clarity] = detector.findPitch(buffer, audioCtx.sampleRate);

  const valid =
    clarity >= CLARITY_THRESHOLD && freq >= MIN_FREQ && freq <= MAX_FREQ;

  if (valid) {
    const midi = freqToMidi(freq);
    const exact = freqToMidiExact(freq);
    const cents = Math.round((exact - midi) * 100);
    state = { ...state, liveMidi: midi, cents, clarity };
    silenceCount = 0;

    if (midi === currentNote) {
      // holding the same note — nothing to do
    } else if (midi === candidate) {
      candidateCount += 1;
      if (candidateCount >= CONFIRM_FRAMES) {
        if (currentNote !== null) noteBus.noteOff(currentNote, "mic");
        currentNote = midi;
        candidate = null;
        candidateCount = 0;
        noteBus.noteOn(midi, Math.min(1, clarity), "mic");
      }
    } else {
      candidate = midi;
      candidateCount = 1;
    }
  } else {
    silenceCount += 1;
    candidate = null;
    candidateCount = 0;
    if (silenceCount >= RELEASE_FRAMES && currentNote !== null) {
      noteBus.noteOff(currentNote, "mic");
      currentNote = null;
      state = { ...state, liveMidi: null, clarity: 0 };
    }
  }

  emit();
  raf = requestAnimationFrame(loop);
}

export async function enableMic(): Promise<MicState> {
  if (state.enabled) return state;
  if (!navigator.mediaDevices?.getUserMedia) {
    state = {
      ...state,
      enabled: false,
      error: "Microphone needs a secure (https) page in a supported browser.",
    };
    emit();
    return state;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    detector = PitchDetector.forFloat32Array(analyser.fftSize);
    detector.minVolumeDecibels = -32;
    buffer = new Float32Array(detector.inputLength);

    state = { ...state, enabled: true, error: undefined };
    emit();
    raf = requestAnimationFrame(loop);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    let message = "Could not access the microphone.";
    if (name === "NotAllowedError" || name === "SecurityError") {
      message =
        "Microphone blocked. Click the camera/lock icon in your browser's address bar and allow the microphone, then try again.";
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      message = "No microphone found. Plug one in and try again.";
    } else if (err instanceof Error && err.message) {
      message = err.message;
    }
    state = { ...state, enabled: false, error: message };
    emit();
  }
  return state;
}

export function disableMic() {
  cancelAnimationFrame(raf);
  if (currentNote !== null) {
    noteBus.noteOff(currentNote, "mic");
    currentNote = null;
  }
  stream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close();
  audioCtx = null;
  stream = null;
  analyser = null;
  detector = null;
  buffer = null;
  state = { enabled: false, liveMidi: null, cents: 0, clarity: 0 };
  emit();
}
