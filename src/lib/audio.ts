// Piano sound via Tone.js. We try to load a real sampled grand piano (the
// public-domain Salamander samples Tone.js hosts); if that fails — offline, or
// the CDN is blocked — we fall back to a warm PolySynth so the app always makes
// sound. Nothing here touches the network until the user first enables audio.

import * as Tone from "tone";
import { midiToFreq } from "./notes";

let instrument: Tone.Sampler | Tone.PolySynth | null = null;
let usingSampler = false;
let samplerRequested = false;

const SAMPLE_BASE = "https://tonejs.github.io/audio/salamander/";

// A sparse map of samples; Tone.Sampler pitch-shifts to fill the gaps.
const SAMPLE_MAP: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

function buildSynth(): Tone.PolySynth {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.4 },
  });
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 });
  synth.connect(reverb);
  reverb.toDestination();
  return synth;
}

/**
 * Call from a user gesture (click/tap/keypress). Safe to call repeatedly — it
 * resumes the audio context every time (gestures can expire across awaits) and
 * gives instant sound via a synth, then upgrades to the sampled grand piano in
 * the background so there's never a silent gap.
 */
export async function initAudio(): Promise<void> {
  try {
    await Tone.start();
  } catch {
    /* not a user gesture yet — will resume on the next one */
  }

  if (!instrument) {
    instrument = buildSynth();
    usingSampler = false;
  }

  if (!samplerRequested) {
    samplerRequested = true;
    loadSampler()
      .then((sampler) => {
        const previous = instrument;
        instrument = sampler;
        usingSampler = true;
        if (previous && previous !== sampler) {
          window.setTimeout(() => {
            try {
              (previous as { dispose?: () => void }).dispose?.();
            } catch {
              /* ignore */
            }
          }, 1500);
        }
      })
      .catch(() => {
        /* keep the synth */
      });
  }
}

function loadSampler(): Promise<Tone.Sampler> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("sample load timeout")),
      6000,
    );
    const sampler = new Tone.Sampler({
      urls: SAMPLE_MAP,
      baseUrl: SAMPLE_BASE,
      release: 1.2,
      onload: () => {
        clearTimeout(timeout);
        const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.16 });
        sampler.connect(reverb);
        reverb.toDestination();
        resolve(sampler);
      },
      onerror: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });
  });
}

export function isUsingSampler(): boolean {
  return usingSampler;
}

export function isAudioReady(): boolean {
  return instrument !== null;
}

export function noteOn(midi: number, velocity = 0.75) {
  if (!instrument) return;
  const freq = midiToFreq(midi);
  if (instrument instanceof Tone.Sampler) {
    instrument.triggerAttack(freq, undefined, velocity);
  } else {
    instrument.triggerAttack(freq, undefined, velocity);
  }
}

export function noteOff(midi: number) {
  if (!instrument) return;
  const freq = midiToFreq(midi);
  instrument.triggerRelease(freq);
}

/** Fire-and-forget a note for a fixed duration (used by playback + previews). */
export function playNote(midi: number, durationSec = 0.5, velocity = 0.75) {
  if (!instrument) return;
  const freq = midiToFreq(midi);
  instrument.triggerAttackRelease(freq, durationSec, undefined, velocity);
}

/** Play a set of notes together (a chord) for a duration. */
export function playChord(midis: number[], durationSec = 0.6, velocity = 0.7) {
  if (!instrument) return;
  const freqs = midis.map(midiToFreq);
  instrument.triggerAttackRelease(freqs, durationSec, undefined, velocity);
}

export function getTransport() {
  return Tone.getTransport();
}

export function now(): number {
  return Tone.now();
}
