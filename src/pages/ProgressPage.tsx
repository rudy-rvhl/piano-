import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ensureSeeded, listScores, type ScoreMeta } from "../lib/storage";
import { buildSampleSongs } from "../lib/samples";
import { getReadingStats, type ReadingStats } from "../lib/readingStats";

export default function ProgressPage() {
  const [scores, setScores] = useState<ScoreMeta[]>([]);
  const [reading, setReading] = useState<ReadingStats | null>(null);

  useEffect(() => {
    ensureSeeded(buildSampleSongs()).then(() => listScores().then(setScores));
    setReading(getReadingStats());
  }, []);

  const practiced = scores.filter((s) => s.progress.timesPracticed > 0);
  const totalPlays = scores.reduce(
    (sum, s) => sum + s.progress.timesPracticed,
    0,
  );
  const readingAcc =
    reading && reading.answered
      ? Math.round((reading.correct / reading.answered) * 100)
      : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your Progress</h1>
          <div className="sub">Keep the streak going. 🎵</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        <div className="card grow">
          <div className="stat-row">
            <div className="stat">
              <span className="num">{scores.length}</span>
              <span className="cap">Pieces in library</span>
            </div>
            <div className="stat">
              <span className="num">{totalPlays}</span>
              <span className="cap">Practice runs</span>
            </div>
            <div className="stat">
              <span className="num">{reading?.answered ?? 0}</span>
              <span className="cap">Notes read</span>
            </div>
            <div className="stat">
              <span className="num">{reading?.bestStreak ?? 0}</span>
              <span className="cap">Best reading streak</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="card grow">
          <h2>Pieces</h2>
          {practiced.length === 0 ? (
            <p className="muted">
              No practice runs yet. Open a piece from your{" "}
              <Link to="/">Library</Link> and press Start.
            </p>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {practiced
                .sort(
                  (a, b) =>
                    (b.progress.lastPracticedAt ?? 0) -
                    (a.progress.lastPracticedAt ?? 0),
                )
                .map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{s.title}</div>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {s.progress.timesPracticed}× ·{" "}
                        {Math.round(s.progress.bestAccuracy * 100)}% best
                      </div>
                    </div>
                    <div className="progress-bar" style={{ width: 140 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.round(
                            s.progress.bestAccuracy * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <Link to={`/practice/${s.id}`} className="btn btn-sm">
                      Practice
                    </Link>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card grow">
          <h2>Note Reading</h2>
          {!reading || reading.answered === 0 ? (
            <p className="muted">
              Train your reading on the <Link to="/read">Read Notes</Link> page.
            </p>
          ) : (
            <>
              <div className="stat-row" style={{ marginBottom: 14 }}>
                <div className="stat">
                  <span className="num">{readingAcc}%</span>
                  <span className="cap">Overall accuracy</span>
                </div>
                <div className="stat">
                  <span className="num">{reading.correct}</span>
                  <span className="cap">Correct</span>
                </div>
              </div>
              <div className="col" style={{ gap: 8 }}>
                {Object.entries(reading.byLevel).map(([id, l]) => (
                  <div
                    key={id}
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div className="grow" style={{ fontSize: "0.85rem" }}>
                      {id}
                    </div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {l.correct}/{l.answered}
                    </div>
                    <div className="progress-bar" style={{ width: 120 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${
                            l.answered
                              ? Math.round((l.correct / l.answered) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
