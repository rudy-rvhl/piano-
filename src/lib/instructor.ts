// The AI piano instructor — "Maestro" — powered by Claude.
//
// Maestro speaks ONLY French (per the product requirement) and is aware of what
// the student is doing in the app: which piece they're practising, where they
// are in it, and how their note-reading is going.
//
// Transport: this is a static web app, so by default it talks to the Claude API
// directly from the browser using the student's own API key (stored locally,
// never sent anywhere but Anthropic). If you'd rather keep the key server-side,
// set VITE_INSTRUCTOR_PROXY to a backend endpoint that forwards { system,
// messages } to the Messages API — the app will prefer that automatically.

import Anthropic from "@anthropic-ai/sdk";
import type { InstructorContext } from "../store/useInstructorContext";

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const KEY_STORAGE = "crescendo:anthropicKey";
// Default model per Anthropic guidance: latest, most capable Claude.
const MODEL = "claude-opus-4-8";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key.trim());
  } catch {
    /* ignore */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

function proxyUrl(): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)
    .VITE_INSTRUCTOR_PROXY;
  return v && v.length ? v : undefined;
}

export function instructorAvailable(): boolean {
  return Boolean(proxyUrl()) || getApiKey().length > 0;
}

// ---- French system prompt -------------------------------------------------

const BASE_PROMPT = `Tu es « Maestro », un professeur de piano chaleureux, patient et expert.
Tu accompagnes un élève qui apprend le piano avec l'application Crescendo, où il téléverse ses propres partitions et s'entraîne note par note.

RÈGLES ABSOLUES :
- Tu réponds TOUJOURS en français, quelle que soit la langue utilisée par l'élève. Ne réponds jamais dans une autre langue.
- Tu es un professeur de musique : tu aides l'élève à LIRE les notes et la partition (portée, clés de sol et de fa, lignes supplémentaires, altérations, rythme, mesures) ET à JOUER au piano (doigtés, posture, tempo, nuances, indépendance des mains).
- Sois encourageant, concret et bienveillant. Tutoie l'élève.
- Sois CONCIS : des réponses courtes et claires, comme à l'oral pendant un cours. Va droit au but, donne ta réponse finale directement sans montrer de raisonnement interne.
- Adapte-toi à un niveau débutant par défaut. Évite le jargon inutile ; quand tu emploies un terme technique, explique-le simplement.
- Quand c'est utile, propose un petit exercice ou une astuce mémo (par ex. « Mi-Sol-Si-Ré-Fa » pour les lignes de la clé de sol).
- Utilise les notes françaises (do, ré, mi, fa, sol, la, si). Si l'élève emploie la notation anglaise (C, D, E…), tu peux donner les deux.
- Tu ne peux pas entendre l'élève jouer ; appuie-toi sur le contexte fourni et sur ce qu'il te décrit.
- N'invente pas le contenu d'une partition que tu ne connais pas : raisonne sur ce que le contexte t'indique, ou demande des précisions.`;

function frenchNote(n: string): string {
  // Map an English note name like "C#4" to French "do#4".
  const map: Record<string, string> = {
    C: "do",
    D: "ré",
    E: "mi",
    F: "fa",
    G: "sol",
    A: "la",
    B: "si",
  };
  const m = n.match(/^([A-G])(#|b)?(-?\d+)?$/);
  if (!m) return n;
  return `${map[m[1]] ?? m[1]}${m[2] ?? ""}${m[3] ?? ""}`;
}

function contextBlock(ctx: InstructorContext): string {
  const lines: string[] = [];
  if (ctx.page === "practice") {
    lines.push("L'élève est sur la page de pratique d'un morceau.");
    if (ctx.pieceTitle)
      lines.push(
        `Morceau en cours : « ${ctx.pieceTitle} »${
          ctx.composer ? ` (${ctx.composer})` : ""
        }.`,
      );
    if (typeof ctx.measure === "number")
      lines.push(`Il se trouve à la mesure ${ctx.measure}.`);
    if (ctx.expectedNotes && ctx.expectedNotes.length) {
      const fr = ctx.expectedNotes.map(frenchNote).join(", ");
      lines.push(`Notes à jouer juste maintenant : ${fr}.`);
    }
    if (ctx.waitMode === false)
      lines.push("Le mode « attente de la bonne note » est désactivé.");
    if (typeof ctx.lastAccuracy === "number")
      lines.push(
        `Sa meilleure précision sur ce morceau : ${Math.round(
          ctx.lastAccuracy * 100,
        )} %.`,
      );
  } else if (ctx.page === "reading") {
    lines.push("L'élève s'entraîne à LIRE les notes (entraîneur de lecture).");
    if (ctx.readingLevel) lines.push(`Niveau choisi : ${ctx.readingLevel}.`);
    if (typeof ctx.readingStreak === "number")
      lines.push(`Série de bonnes réponses : ${ctx.readingStreak}.`);
  } else if (ctx.page === "library") {
    lines.push("L'élève est dans sa bibliothèque de partitions.");
  }
  if (!lines.length) return "";
  return `\n\nCONTEXTE ACTUEL DANS L'APPLICATION (pour t'aider à être précis) :\n- ${lines.join(
    "\n- ",
  )}`;
}

export function buildSystemPrompt(ctx: InstructorContext): string {
  return BASE_PROMPT + contextBlock(ctx);
}

// ---- Sending --------------------------------------------------------------

export interface SendOptions {
  history: ChatMessage[];
  context: InstructorContext;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream a reply from Maestro. Returns the full text. Throws on auth/network
 * errors so the UI can surface a friendly (French) message.
 */
export async function sendToInstructor(opts: SendOptions): Promise<string> {
  const system = buildSystemPrompt(opts.context);
  const messages = opts.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const proxy = proxyUrl();
  if (proxy) {
    return sendViaProxy(proxy, system, messages, opts.onDelta, opts.signal);
  }
  return sendViaBrowser(system, messages, opts.onDelta, opts.signal);
}

async function sendViaBrowser(
  system: string,
  messages: { role: ChatRole; content: string }[],
  onDelta: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("NO_KEY");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: 1600,
      system,
      messages,
    },
    { signal },
  );

  stream.on("text", (delta) => onDelta(delta));
  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function sendViaProxy(
  url: string,
  system: string,
  messages: { role: ChatRole; content: string }[],
  onDelta: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, system, messages, max_tokens: 1600 }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`PROXY_${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  const text = data.text ?? "";
  onDelta(text);
  return text;
}
