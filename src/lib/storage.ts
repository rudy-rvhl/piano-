// Persistence for the user's score library, backed by IndexedDB (via
// idb-keyval) so big MusicXML files survive reloads without bumping into the
// ~5 MB localStorage ceiling. A lightweight metadata index lets the library
// list pieces without loading every file.

import { get, set, del, keys } from "idb-keyval";
import { unzipSync, strFromU8 } from "fflate";

export interface ScoreProgress {
  timesPracticed: number;
  bestAccuracy: number; // 0..1
  lastPracticedAt?: number;
}

export interface ScoreMeta {
  id: string;
  title: string;
  composer?: string;
  source: "builtin" | "upload";
  createdAt: number;
  progress: ScoreProgress;
}

const INDEX_KEY = "crescendo:index";
const SCORE_PREFIX = "crescendo:score:";
const SEED_FLAG = "crescendo:seeded:v1";

function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

export async function listScores(): Promise<ScoreMeta[]> {
  const index = (await get<ScoreMeta[]>(INDEX_KEY)) ?? [];
  return index.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getScoreXml(id: string): Promise<string | undefined> {
  return get<string>(SCORE_PREFIX + id);
}

export async function getScoreMeta(id: string): Promise<ScoreMeta | undefined> {
  const index = await listScores();
  return index.find((s) => s.id === id);
}

async function writeIndex(index: ScoreMeta[]): Promise<void> {
  await set(INDEX_KEY, index);
}

export async function addScore(input: {
  title: string;
  composer?: string;
  xml: string;
  source?: "builtin" | "upload";
}): Promise<ScoreMeta> {
  const meta: ScoreMeta = {
    id: uid(),
    title: input.title.trim() || "Untitled",
    composer: input.composer?.trim() || undefined,
    source: input.source ?? "upload",
    createdAt: Date.now(),
    progress: { timesPracticed: 0, bestAccuracy: 0 },
  };
  await set(SCORE_PREFIX + meta.id, input.xml);
  const index = (await get<ScoreMeta[]>(INDEX_KEY)) ?? [];
  index.push(meta);
  await writeIndex(index);
  return meta;
}

export async function deleteScore(id: string): Promise<void> {
  await del(SCORE_PREFIX + id);
  const index = (await get<ScoreMeta[]>(INDEX_KEY)) ?? [];
  await writeIndex(index.filter((s) => s.id !== id));
}

export async function recordPractice(
  id: string,
  accuracy: number,
): Promise<void> {
  const index = (await get<ScoreMeta[]>(INDEX_KEY)) ?? [];
  const meta = index.find((s) => s.id === id);
  if (!meta) return;
  meta.progress.timesPracticed += 1;
  meta.progress.bestAccuracy = Math.max(meta.progress.bestAccuracy, accuracy);
  meta.progress.lastPracticedAt = Date.now();
  await writeIndex(index);
}

/**
 * Read an uploaded file into a MusicXML string. Handles both plain
 * .musicxml/.xml and compressed .mxl (a zip whose META-INF/container.xml points
 * at the real score).
 */
export async function readMusicXmlFile(file: File): Promise<string> {
  const isCompressed =
    file.name.toLowerCase().endsWith(".mxl") ||
    file.type === "application/vnd.recordare.musicxml";

  if (!isCompressed) {
    return file.text();
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(buf);

  // Prefer the path named in META-INF/container.xml, else the first .xml that
  // isn't the container itself.
  let targetPath: string | undefined;
  const container = files["META-INF/container.xml"];
  if (container) {
    const containerXml = strFromU8(container);
    const match = containerXml.match(/full-path="([^"]+)"/);
    if (match) targetPath = match[1];
  }
  if (!targetPath || !files[targetPath]) {
    targetPath = Object.keys(files).find(
      (p) =>
        (p.toLowerCase().endsWith(".xml") ||
          p.toLowerCase().endsWith(".musicxml")) &&
        !p.startsWith("META-INF"),
    );
  }
  if (!targetPath || !files[targetPath]) {
    throw new Error("Could not find a MusicXML document inside the .mxl file.");
  }
  return strFromU8(files[targetPath]);
}

/** Quick sanity check that a string looks like MusicXML before we store it. */
export function looksLikeMusicXml(xml: string): boolean {
  return /score-partwise|score-timewise/i.test(xml);
}

/** Pull a human title out of MusicXML, falling back to the filename. */
export function extractTitle(xml: string, fallback: string): string {
  const work = xml.match(/<work-title>([^<]+)<\/work-title>/i);
  if (work && work[1].trim()) return decodeEntities(work[1].trim());
  const movement = xml.match(/<movement-title>([^<]+)<\/movement-title>/i);
  if (movement && movement[1].trim()) return decodeEntities(movement[1].trim());
  return fallback.replace(/\.(musicxml|xml|mxl)$/i, "");
}

export function extractComposer(xml: string): string | undefined {
  const m = xml.match(
    /<creator[^>]*type="composer"[^>]*>([^<]+)<\/creator>/i,
  );
  return m && m[1].trim() ? decodeEntities(m[1].trim()) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Memoize seeding so concurrent callers (App + Library mount on first load)
// share one promise instead of racing — which would otherwise double-insert the
// samples before the seeded flag is written.
let seedingPromise: Promise<void> | null = null;

/** Idempotent, race-safe seeding. Await this before listing on first load. */
export function ensureSeeded(
  samples: { title: string; composer?: string; xml: string }[],
): Promise<void> {
  if (!seedingPromise) seedingPromise = seedBuiltins(samples);
  return seedingPromise;
}

/** One-time seeding of built-in sample songs. */
export async function seedBuiltins(
  samples: { title: string; composer?: string; xml: string }[],
): Promise<void> {
  const seeded = await get<boolean>(SEED_FLAG);
  if (seeded) return;
  const existing = await keys();
  if (existing.length > 0 && (await get<ScoreMeta[]>(INDEX_KEY))?.length) {
    // Library already has content; just mark seeded so we don't double up.
    await set(SEED_FLAG, true);
    return;
  }
  for (const s of samples) {
    await addScore({ ...s, source: "builtin" });
  }
  await set(SEED_FLAG, true);
}
