// Tiny localStorage-backed stats for the note-reading trainer, surfaced on the
// Progress page.

export interface ReadingStats {
  answered: number;
  correct: number;
  bestStreak: number;
  byLevel: Record<string, { answered: number; correct: number }>;
}

const KEY = "crescendo:reading";

const empty: ReadingStats = {
  answered: 0,
  correct: 0,
  bestStreak: 0,
  byLevel: {},
};

export function getReadingStats(): ReadingStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty, byLevel: {} };
    const parsed = JSON.parse(raw) as ReadingStats;
    return { ...empty, ...parsed, byLevel: parsed.byLevel ?? {} };
  } catch {
    return { ...empty, byLevel: {} };
  }
}

export function recordAnswer(
  levelId: string,
  correct: boolean,
  streak: number,
): ReadingStats {
  const s = getReadingStats();
  s.answered += 1;
  if (correct) s.correct += 1;
  s.bestStreak = Math.max(s.bestStreak, streak);
  const lvl = s.byLevel[levelId] ?? { answered: 0, correct: 0 };
  lvl.answered += 1;
  if (correct) lvl.correct += 1;
  s.byLevel[levelId] = lvl;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
  return s;
}
