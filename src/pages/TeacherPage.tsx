import { useEffect, useRef, useState } from "react";
import {
  clearApiKey,
  getApiKey,
  instructorAvailable,
  sendToInstructor,
  setApiKey,
  type ChatMessage,
} from "../lib/instructor";
import { useInstructorContext } from "../store/useInstructorContext";

const GREETING =
  "Bonjour ! Je suis Maestro, ton professeur de piano. Pose-moi une question sur la lecture des notes, le rythme, les doigtés… ou demande-moi un exercice. Je suis là pour t'aider à lire et à jouer. 🎹";

const QUICK_PROMPTS = [
  "Comment lire les notes en clé de sol ?",
  "Donne-moi un petit exercice de lecture.",
  "Explique-moi les lignes supplémentaires.",
  "Comment bien placer mes doigts ?",
];

export default function TeacherPage() {
  const ctx = useInstructorContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [needsKey, setNeedsKey] = useState(!instructorAvailable());
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, draft]);

  const saveKey = () => {
    if (!keyInput.trim()) return;
    setApiKey(keyInput);
    setKeyInput("");
    setNeedsKey(false);
    setError("");
  };

  const forgetKey = () => {
    clearApiKey();
    setShowKey(false);
    setNeedsKey(!instructorAvailable());
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    if (!instructorAvailable()) {
      setNeedsKey(true);
      return;
    }
    setError("");
    const userMsg: ChatMessage = { role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setDraft("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const full = await sendToInstructor({
        history,
        context: {
          page: ctx.page,
          pieceTitle: ctx.pieceTitle,
          composer: ctx.composer,
          measure: ctx.measure,
          expectedNotes: ctx.expectedNotes,
          waitMode: ctx.waitMode,
          lastAccuracy: ctx.lastAccuracy,
          readingLevel: ctx.readingLevel,
          readingStreak: ctx.readingStreak,
        },
        onDelta: (d) => setDraft((prev) => prev + d),
        signal: controller.signal,
      });
      setMessages((m) => [...m, { role: "assistant", content: full }]);
    } catch (err) {
      handleError(err);
    } finally {
      setStreaming(false);
      setDraft("");
      abortRef.current = null;
    }
  };

  const handleError = (err: unknown) => {
    const e = err as { message?: string; status?: number; name?: string };
    if (e?.message === "NO_KEY") {
      setNeedsKey(true);
      return;
    }
    if (e?.name === "AbortError") return;
    if (e?.status === 401)
      setError("Clé API invalide. Vérifie ta clé Anthropic et réessaie.");
    else if (e?.status === 429)
      setError("Trop de requêtes pour le moment. Réessaie dans un instant.");
    else if (e?.message?.startsWith("PROXY_"))
      setError("Le serveur du professeur a renvoyé une erreur. Réessaie.");
    else
      setError(
        "Impossible de joindre le professeur. Vérifie ta connexion (et ta clé API).",
      );
  };

  const stop = () => abortRef.current?.abort();

  const contextSummary = (() => {
    if (ctx.page === "practice" && ctx.pieceTitle)
      return `Maestro voit : « ${ctx.pieceTitle} »${
        ctx.measure ? `, mesure ${ctx.measure}` : ""
      }`;
    if (ctx.page === "reading" && ctx.readingLevel)
      return `Maestro voit : lecture — ${ctx.readingLevel}`;
    return "Maestro s'adapte à ce que tu fais dans l'application.";
  })();

  if (needsKey) {
    return (
      <div style={{ maxWidth: 620 }}>
        <div className="page-head">
          <div>
            <h1>🎓 Professeur Maestro</h1>
            <div className="sub">Ton professeur de piano, en français.</div>
          </div>
        </div>
        <div className="card col" style={{ gap: 14 }}>
          <p style={{ margin: 0 }}>
            Maestro utilise l'IA Claude d'Anthropic pour répondre à tes
            questions. Pour l'activer, ajoute ta <strong>clé API Anthropic</strong>.
            Elle est enregistrée <strong>uniquement dans ton navigateur</strong>{" "}
            et n'est envoyée qu'à Anthropic.
          </p>
          <input
            className="text-input"
            type="password"
            placeholder="sk-ant-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
          />
          <div className="btn-row">
            <button className="btn btn-primary" onClick={saveKey}>
              Activer Maestro
            </button>
            <a
              className="btn btn-ghost"
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
            >
              Obtenir une clé ↗
            </a>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
            Astuce développeur : tu peux aussi configurer{" "}
            <code>VITE_INSTRUCTOR_PROXY</code> pour passer par ton propre serveur
            et garder la clé côté backend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-layout">
      <div className="page-head">
        <div>
          <h1>🎓 Professeur Maestro</h1>
          <div className="sub">{contextSummary}</div>
        </div>
        <div className="btn-row">
          {messages.length > 0 && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setMessages([]);
                setError("");
              }}
            >
              🗑 Effacer
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowKey((s) => !s)}
          >
            ⚙︎ Clé API
          </button>
        </div>
      </div>

      {showKey && (
        <div className="banner" style={{ marginBottom: 12 }}>
          <span>
            Ta clé est enregistrée localement.{" "}
            {getApiKey() ? `(${getApiKey().slice(0, 7)}…)` : ""}
          </span>
          <button className="btn btn-sm btn-danger" onClick={forgetKey}>
            Oublier la clé
          </button>
        </div>
      )}

      <div className="chat" ref={scrollRef}>
        {messages.length === 0 && !streaming && (
          <div className="bubble maestro">{GREETING}</div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role === "user" ? "me" : "maestro"}`}
          >
            {m.content}
          </div>
        ))}
        {streaming && (
          <div className="bubble maestro">
            {draft || <span className="typing">Maestro réfléchit…</span>}
          </div>
        )}
      </div>

      {error && (
        <div className="banner warn" style={{ marginBottom: 10 }}>
          ⚠ {error}
        </div>
      )}

      {messages.length === 0 && (
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} className="badge" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="composer">
        <textarea
          className="text-input"
          rows={1}
          placeholder="Pose ta question au professeur…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {streaming ? (
          <button className="btn btn-danger" onClick={stop}>
            ⏹ Stop
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => send(input)}
            disabled={!input.trim()}
          >
            Envoyer
          </button>
        )}
      </div>
    </div>
  );
}
