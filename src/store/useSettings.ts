// Small global settings store, persisted to localStorage.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NoteLabelMode = "off" | "letters" | "solfege";
export type Hand = "both" | "right" | "left";

export interface SettingsState {
  /** Spell black keys with flats (Db) instead of sharps (C#). */
  useFlats: boolean;
  /** Print note names on the on-screen keys. */
  showKeyLabels: boolean;
  /** Practice waits for the correct note before advancing. */
  waitMode: boolean;
  /** Accept the right pitch in any octave (handy for mic input). */
  octaveTolerant: boolean;
  /** Highlight which key to press during practice. */
  showHints: boolean;
  /** Print note names under each note on the sheet. */
  noteLabels: NoteLabelMode;
  /** Show the "Note guide" teaching panel during practice. */
  showNoteGuide: boolean;
  /** Which hand to practise: both, right (top staff), or left (lower staff). */
  hand: Hand;

  setUseFlats: (v: boolean) => void;
  setShowKeyLabels: (v: boolean) => void;
  setWaitMode: (v: boolean) => void;
  setOctaveTolerant: (v: boolean) => void;
  setShowHints: (v: boolean) => void;
  setNoteLabels: (v: NoteLabelMode) => void;
  setShowNoteGuide: (v: boolean) => void;
  setHand: (v: Hand) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      useFlats: false,
      showKeyLabels: true,
      waitMode: true,
      octaveTolerant: false,
      showHints: true,
      noteLabels: "off",
      showNoteGuide: true,
      hand: "both",

      setUseFlats: (v) => set({ useFlats: v }),
      setShowKeyLabels: (v) => set({ showKeyLabels: v }),
      setWaitMode: (v) => set({ waitMode: v }),
      setOctaveTolerant: (v) => set({ octaveTolerant: v }),
      setShowHints: (v) => set({ showHints: v }),
      setNoteLabels: (v) => set({ noteLabels: v }),
      setShowNoteGuide: (v) => set({ showNoteGuide: v }),
      setHand: (v) => set({ hand: v }),
    }),
    { name: "crescendo:settings" },
  ),
);
