import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addScore,
  deleteScore,
  ensureSeeded,
  extractComposer,
  extractTitle,
  listScores,
  looksLikeMusicXml,
  readFileAsDataUrl,
  readMusicXmlFile,
  type ScoreMeta,
} from "../lib/storage";
import { importMidiFile } from "../lib/midiImport";
import { buildSampleSongs } from "../lib/samples";
import { useInstructorContext } from "../store/useInstructorContext";

export default function LibraryPage() {
  const [scores, setScores] = useState<ScoreMeta[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    await ensureSeeded(buildSampleSongs());
    setScores(await listScores());
  }, []);

  const setInstructorContext = useInstructorContext((s) => s.setContext);
  useEffect(() => {
    refresh();
    setInstructorContext({ page: "library" });
  }, [refresh, setInstructorContext]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true);
      setMessage("");
      let added = 0;
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith(".pdf") || file.type === "application/pdf") {
            // PDFs are view-only (no per-note data).
            const dataUrl = await readFileAsDataUrl(file);
            await addScore({
              title: file.name.replace(/\.pdf$/i, ""),
              xml: dataUrl,
              source: "upload",
              kind: "pdf",
            });
            added++;
          } else if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
            // MIDI is converted to interactive notation.
            const { title, xml } = await importMidiFile(file);
            await addScore({ title, xml, source: "upload", kind: "musicxml" });
            added++;
          } else {
            const xml = await readMusicXmlFile(file);
            if (!looksLikeMusicXml(xml)) {
              errors.push(`${file.name}: unsupported file (need MusicXML, MIDI, or PDF)`);
              continue;
            }
            await addScore({
              title: extractTitle(xml, file.name),
              composer: extractComposer(xml),
              xml,
              source: "upload",
            });
            added++;
          }
        } catch (err) {
          errors.push(
            `${file.name}: ${
              err instanceof Error ? err.message : "could not read"
            }`,
          );
        }
      }
      await refresh();
      setBusy(false);
      if (added && !errors.length)
        setMessage(`Added ${added} score${added > 1 ? "s" : ""}. 🎉`);
      else if (errors.length) setMessage(errors.join(" · "));
    },
    [refresh],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Remove “${title}” from your library?`)) return;
    await deleteScore(id);
    refresh();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your Library</h1>
          <div className="sub">
            Upload your own sheet music and learn to play it, note by note.
          </div>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            ⬆ Upload music
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xml,.musicxml,.mxl,.mid,.midi,.pdf,application/xml,text/xml,audio/midi,audio/x-midi,application/pdf"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        style={{ marginBottom: 18 }}
      >
        <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>🎼</div>
        <div>
          <strong>Drop a file here</strong> or click to browse
        </div>
        <div className="muted" style={{ fontSize: "0.82rem", marginTop: 6 }}>
          <strong>MusicXML</strong> (<code>.musicxml</code>, <code>.xml</code>,{" "}
          <code>.mxl</code>) and <strong>MIDI</strong> (<code>.mid</code>) become
          fully interactive. <strong>PDF</strong> is view-only. See{" "}
          <a href="#/help">Help</a>.
        </div>
      </div>

      {message && (
        <div className="banner" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      {busy && <p>Reading file…</p>}

      {scores.length === 0 && !busy ? (
        <div className="empty-state">
          <div className="big">🎹</div>
          <p>Your library is empty. Upload a score to get started.</p>
        </div>
      ) : (
        <div className="library-grid">
          {scores.map((s) => (
            <div key={s.id} className="song-card">
              <div>
                <div className="title">{s.title}</div>
                {s.composer && <div className="composer">{s.composer}</div>}
              </div>
              <div className="meta">
                {s.source === "builtin" ? (
                  <span className="badge dim">Sample</span>
                ) : (
                  <span className="badge">Yours</span>
                )}
                {s.kind === "pdf" && <span className="badge gold">PDF</span>}
                {s.progress.timesPracticed > 0 && (
                  <span className="badge gold">
                    ★ {Math.round(s.progress.bestAccuracy * 100)}%
                  </span>
                )}
                {s.progress.timesPracticed > 0 && (
                  <span className="badge dim">
                    {s.progress.timesPracticed}× played
                  </span>
                )}
              </div>
              <div className="actions">
                <button
                  className="btn btn-primary btn-sm grow"
                  onClick={() => navigate(`/practice/${s.id}`)}
                >
                  {s.kind === "pdf" ? "👁 View" : "▶ Practice"}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(s.id, s.title)}
                  title="Remove"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
