import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { noteBus } from "./lib/noteBus";
import {
  initAudio,
  noteOn as audioOn,
  noteOff as audioOff,
} from "./lib/audio";
import { ensureSeeded } from "./lib/storage";
import { buildSampleSongs } from "./lib/samples";
import LibraryPage from "./pages/LibraryPage";
import PracticePage from "./pages/PracticePage";
import ReadingPage from "./pages/ReadingPage";
import ProgressPage from "./pages/ProgressPage";
import HelpPage from "./pages/HelpPage";
import TeacherPage from "./pages/TeacherPage";

const NAV = [
  { to: "/", label: "Library", icon: "📚", end: true },
  { to: "/read", label: "Read Notes", icon: "🎼" },
  { to: "/teacher", label: "Professeur", icon: "🎓" },
  { to: "/progress", label: "Progress", icon: "📈" },
  { to: "/help", label: "Help", icon: "💡" },
];

export default function App() {
  // Bridge every note source into the piano sound. Notes detected from the
  // microphone are NOT re-synthesised — the real instrument already sounded.
  useEffect(() => {
    const off1 = noteBus.onNoteOn((e) => {
      if (e.source !== "mic") audioOn(e.midi, e.velocity);
    });
    const off2 = noteBus.onNoteOff((e) => {
      if (e.source !== "mic") audioOff(e.midi);
    });
    return () => {
      off1();
      off2();
    };
  }, []);

  // Warm up the audio engine on the very first user gesture anywhere.
  useEffect(() => {
    const handler = () => {
      void initAudio();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  // Seed the built-in sample songs once.
  useEffect(() => {
    ensureSeeded(buildSampleSongs()).catch((e) =>
      console.error("seed failed", e),
    );
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🎹</div>
          <div className="name">
            Cresc<span>endo</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="hint-card">
          Upload a <strong>MusicXML</strong> file in the Library, then open it to
          practise. Crescendo highlights each note and waits for you to play it.
        </div>
      </aside>

      <main className="main" id="main-scroll">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/practice/:id" element={<PracticePage />} />
          <Route path="/read" element={<ReadingPage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </main>

      <nav className="mobile-tabs">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="ico">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
