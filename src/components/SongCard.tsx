import { useEffect, useRef, useState } from "react";
import Cover from "./Cover";
import { getScoreContent, type ScoreMeta } from "../lib/storage";
import { startPreview, stopPreview } from "../lib/preview";

interface SongCardProps {
  meta: ScoreMeta;
  onPractice: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

export default function SongCard({ meta, onPractice, onDelete }: SongCardProps) {
  const [playing, setPlaying] = useState(false);
  const enterTimer = useRef<number | undefined>(undefined);

  const begin = async () => {
    if (meta.kind === "pdf") return;
    const xml = await getScoreContent(meta.id);
    if (!xml) return;
    const started = startPreview(xml, {
      maxSeconds: 5,
      onEnd: () => setPlaying(false),
    });
    setPlaying(started);
  };

  // Hover intent: small delay so sweeping the mouse doesn't fire previews.
  const onEnter = () => {
    if (meta.kind === "pdf") return;
    window.clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(begin, 220);
  };
  const onLeave = () => {
    window.clearTimeout(enterTimer.current);
    stopPreview();
    setPlaying(false);
  };

  const onCoverClick = () => {
    if (playing) {
      stopPreview();
      setPlaying(false);
    } else {
      void begin();
    }
  };

  useEffect(
    () => () => {
      window.clearTimeout(enterTimer.current);
      stopPreview();
    },
    [],
  );

  const acc = Math.round(meta.progress.bestAccuracy * 100);

  return (
    <div
      className={`song-card${playing ? " playing" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className="cover-wrap"
        onClick={onCoverClick}
        role="button"
        tabIndex={0}
        aria-label={`Preview ${meta.title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCoverClick();
          }
        }}
      >
        <Cover
          title={meta.title}
          composer={meta.composer}
          kind={meta.kind}
          playing={playing}
        />
      </div>

      <div className="song-card-body">
        <div className="title">{meta.title}</div>
        {meta.composer && <div className="composer">{meta.composer}</div>}

        <div className="meta">
          {meta.source === "builtin" ? (
            <span className="badge dim">Sample</span>
          ) : (
            <span className="badge">Yours</span>
          )}
          {meta.kind === "pdf" && <span className="badge gold">PDF</span>}
          {meta.progress.timesPracticed > 0 && (
            <span className="badge gold">★ {acc}%</span>
          )}
          {meta.progress.timesPracticed > 0 && (
            <span className="badge dim">
              {meta.progress.timesPracticed}× played
            </span>
          )}
        </div>

        <div className="actions">
          <button
            className="btn btn-primary btn-sm grow"
            onClick={() => onPractice(meta.id)}
          >
            {meta.kind === "pdf" ? "👁 View" : "▶ Practice"}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(meta.id, meta.title)}
            title="Remove"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
