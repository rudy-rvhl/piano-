// Live, app-wide context the AI instructor can see: which page the student is
// on, the piece they're practising, where they are in it, and how the reading
// trainer is going. Pages update this; the Professeur page reads it so the tutor
// can give specific, situated advice.

import { create } from "zustand";

export interface InstructorContext {
  page: "library" | "practice" | "reading" | "teacher" | "other";
  pieceTitle?: string;
  composer?: string;
  measure?: number;
  expectedNotes?: string[];
  waitMode?: boolean;
  lastAccuracy?: number;
  readingLevel?: string;
  readingStreak?: number;
}

interface ContextStore extends InstructorContext {
  setContext: (patch: Partial<InstructorContext>) => void;
  reset: () => void;
}

const initial: InstructorContext = { page: "other" };

export const useInstructorContext = create<ContextStore>((set) => ({
  ...initial,
  setContext: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set({ ...initial }),
}));
