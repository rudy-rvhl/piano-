// Public-domain melodies that seed a fresh library so the app is useful before
// the user uploads anything. Each is a compact note array compiled to MusicXML.

import { buildMusicXML, type SimpleNote } from "./musicxmlBuilder";

const q = (midi: number | null): SimpleNote => ({ midi, beats: 1 });
const h = (midi: number | null): SimpleNote => ({ midi, beats: 2 });
const e = (midi: number | null): SimpleNote => ({ midi, beats: 0.5 });
const dq = (midi: number | null): SimpleNote => ({ midi, beats: 1.5 });

// MIDI references
const C4 = 60,
  D4 = 62,
  E4 = 64,
  F4 = 65,
  G4 = 67,
  A4 = 69,
  B4 = 71,
  C5 = 72,
  D5 = 74,
  E5 = 76;
const Gs4 = 68,
  Ds5 = 75;

// --- Ode to Joy (Beethoven) ------------------------------------------------
const odeToJoy: SimpleNote[] = [
  q(E4), q(E4), q(F4), q(G4),
  q(G4), q(F4), q(E4), q(D4),
  q(C4), q(C4), q(D4), q(E4),
  dq(E4), e(D4), h(D4),
  q(E4), q(E4), q(F4), q(G4),
  q(G4), q(F4), q(E4), q(D4),
  q(C4), q(C4), q(D4), q(E4),
  dq(D4), e(C4), h(C4),
];

// --- Twinkle, Twinkle, Little Star -----------------------------------------
const twinkle: SimpleNote[] = [
  q(C4), q(C4), q(G4), q(G4),
  q(A4), q(A4), h(G4),
  q(F4), q(F4), q(E4), q(E4),
  q(D4), q(D4), h(C4),
  q(G4), q(G4), q(F4), q(F4),
  q(E4), q(E4), h(D4),
  q(G4), q(G4), q(F4), q(F4),
  q(E4), q(E4), h(D4),
  q(C4), q(C4), q(G4), q(G4),
  q(A4), q(A4), h(G4),
  q(F4), q(F4), q(E4), q(E4),
  q(D4), q(D4), h(C4),
];

// --- C major scale, up and down (a reading warm-up) ------------------------
const cMajorScale: SimpleNote[] = [
  q(C4), q(D4), q(E4), q(F4),
  q(G4), q(A4), q(B4), q(C5),
  q(C5), q(B4), q(A4), q(G4),
  q(F4), q(E4), q(D4), q(C4),
];

// --- Für Elise, opening (right hand), 3/8 — shows accidentals --------------
const furElise: SimpleNote[] = [
  e(E5), e(Ds5), e(E5),
  e(Ds5), e(E5), e(B4),
  e(D5), e(C5), e(A4),
  e(null), e(C4), e(E4),
  e(A4), e(B4), e(null),
  e(null), e(E4), e(Gs4),
  e(B4), e(C5), e(null),
  e(null), e(E5), e(Ds5),
  e(E5), e(Ds5), e(E5),
  e(Ds5), e(E5), e(B4),
  e(D5), e(C5), e(A4),
  e(null), e(C4), e(E4),
  e(A4), e(B4), e(null),
  e(null), e(E4), e(C5),
  e(B4), e(A4), e(null),
];

// --- A gentle five-finger melody in the treble (original, easy) ------------
const firstSteps: SimpleNote[] = [
  q(C4), q(D4), q(E4), q(F4),
  q(G4), q(G4), h(G4),
  q(F4), q(E4), q(D4), q(C4),
  h(C4), h(C4),
  q(E4), q(F4), q(G4), q(A4),
  q(B4), q(B4), h(B4),
  q(A4), q(G4), q(F4), q(E4),
  h(D4), h(C4),
];

// --- A short bass-clef reading study (left hand) ---------------------------
const C3 = 48,
  D3 = 50,
  E3 = 52,
  F3 = 53,
  G3 = 55,
  A3 = 57,
  B3 = 59,
  C2 = 36;
const bassWarmup: SimpleNote[] = [
  q(C3), q(D3), q(E3), q(F3),
  q(G3), q(A3), q(B3), q(C4),
  q(C4), q(B3), q(A3), q(G3),
  q(F3), q(E3), q(D3), q(C3),
  h(C3), h(G3),
  h(C3), h(C2),
];

export interface SampleSong {
  title: string;
  composer?: string;
  xml: string;
}

export function buildSampleSongs(): SampleSong[] {
  return [
    {
      title: "First Steps in C",
      composer: "Crescendo",
      xml: buildMusicXML(firstSteps, {
        title: "First Steps in C",
        composer: "Crescendo",
        tempo: 90,
      }),
    },
    {
      title: "Ode to Joy",
      composer: "Ludwig van Beethoven",
      xml: buildMusicXML(odeToJoy, {
        title: "Ode to Joy",
        composer: "Ludwig van Beethoven",
        tempo: 100,
      }),
    },
    {
      title: "Twinkle, Twinkle, Little Star",
      composer: "Traditional",
      xml: buildMusicXML(twinkle, {
        title: "Twinkle, Twinkle, Little Star",
        composer: "Traditional",
        tempo: 100,
      }),
    },
    {
      title: "C Major Scale",
      composer: "Exercise",
      xml: buildMusicXML(cMajorScale, {
        title: "C Major Scale",
        composer: "Exercise",
        tempo: 80,
      }),
    },
    {
      title: "Bass Clef Warm-Up",
      composer: "Exercise",
      xml: buildMusicXML(bassWarmup, {
        title: "Bass Clef Warm-Up",
        composer: "Exercise",
        clef: "bass",
        tempo: 80,
      }),
    },
    {
      title: "Für Elise (Opening)",
      composer: "Ludwig van Beethoven",
      xml: buildMusicXML(furElise, {
        title: "Für Elise (Opening)",
        composer: "Ludwig van Beethoven",
        beatsPerMeasure: 3,
        beatType: 8,
        tempo: 70,
      }),
    },
  ];
}
