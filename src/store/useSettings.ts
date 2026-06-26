// Small global settings store, persisted to localStorage.

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

  setUseFlats: (v: boolean) => void;
  setShowKeyLabels: (v: boolean) => void;
  setWaitMode: (v: boolean) => void;
  setOctaveTolerant: (v: boolean) => void;
  setShowHints: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      useFlats: false,
      showKeyLabels: true,
      waitMode: true,
      octaveTolerant: false,
      showHints: true,

      setUseFlats: (v) => set({ useFlats: v }),
      setShowKeyLabels: (v) => set({ showKeyLabels: v }),
      setWaitMode: (v) => set({ waitMode: v }),
      setOctaveTolerant: (v) => set({ octaveTolerant: v }),
      setShowHints: (v) => set({ showHints: v }),
    }),
    { name: "crescendo:settings" },
  ),
);
