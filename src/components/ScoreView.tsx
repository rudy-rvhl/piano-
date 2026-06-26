import { useEffect, useRef, useState } from "react";
import { ScoreEngine } from "../lib/scoreEngine";

interface ScoreViewProps {
  xml: string | null;
  onReady?: (engine: ScoreEngine) => void;
}

/**
 * Renders a MusicXML string with OpenSheetMusicDisplay and hands the live
 * ScoreEngine back to the parent so it can drive the practice cursor.
 */
export default function ScoreView({ xml, onReady }: ScoreViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ScoreEngine | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!hostRef.current || !xml) return;
    let cancelled = false;
    const host = hostRef.current;
    host.innerHTML = "";
    setStatus("loading");
    setError("");

    const engine = new ScoreEngine(host);
    engineRef.current = engine;

    engine
      .load(xml)
      .then(() => {
        if (cancelled) {
          engine.dispose();
          return;
        }
        setStatus("ready");
        onReady?.(engine);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Score load failed", err);
        setError(
          err instanceof Error ? err.message : "Could not render this score.",
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  // Re-layout on container resize so the staff reflows nicely.
  useEffect(() => {
    if (!hostRef.current) return;
    const ro = new ResizeObserver(() => {
      if (engineRef.current && status === "ready") {
        try {
          engineRef.current.render();
        } catch {
          /* ignore mid-render resizes */
        }
      }
    });
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [status]);

  return (
    <div className={`score-wrap${status !== "ready" ? " empty" : ""}`}>
      {status === "loading" && <div>Rendering score…</div>}
      {status === "error" && (
        <div style={{ color: "#b00", padding: 16, textAlign: "center" }}>
          <strong>Couldn’t open this score.</strong>
          <div style={{ fontSize: "0.85rem", marginTop: 6 }}>{error}</div>
        </div>
      )}
      <div ref={hostRef} style={{ width: "100%" }} />
    </div>
  );
}
