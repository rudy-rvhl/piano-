export default function HelpPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>How Crescendo Works</h1>
          <div className="sub">
            Upload your own sheet music, learn to read it, and play it note by
            note.
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        <div className="card">
          <h2>🎼 1. Add your sheet music</h2>
          <p>
            On the <a href="#/">Library</a> page, drop in a file. Crescendo
            accepts three kinds, and everything is stored privately in your
            browser — nothing is uploaded to a server:
          </p>
          <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
            <li>
              <strong>MusicXML</strong> (<code>.musicxml</code>,{" "}
              <code>.xml</code>, <code>.mxl</code>) — the universal sheet-music
              format. Fully interactive.
            </li>
            <li>
              <strong>MIDI</strong> (<code>.mid</code>, <code>.midi</code>) —
              automatically converted to notation, so it’s fully interactive
              too (great for the many free MIDI files online).
            </li>
            <li>
              <strong>PDF</strong> — displayed for reading and playing along.
              PDFs are images, so highlight-and-wait practice isn’t possible on
              them; use MusicXML or MIDI for guided practice.
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            <strong>Where do I get MusicXML?</strong> It’s free:
          </p>
          <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
            <li>
              Open any piece in <strong>MuseScore</strong> (free desktop app) and
              choose <em>File → Export → MusicXML</em>.
            </li>
            <li>
              Download from <strong>musescore.com</strong>, IMSLP, or the many
              free MusicXML libraries online.
            </li>
            <li>
              Most notation apps (Finale, Sibelius, Dorico, Flat.io) export
              MusicXML too.
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>▶ 2. Practise in “wait” mode</h2>
          <p>
            Open a piece and press <strong>Start practice</strong>. Crescendo
            highlights the next note on the staff <em>and</em> on the keyboard,
            then waits for you to play it correctly before moving on — so you
            never get lost. Get it wrong and the key flashes red; get it right
            and it turns green and advances.
          </p>
          <p style={{ marginBottom: 0 }}>Handy toggles:</p>
          <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
            <li>
              <strong>Wait for me</strong> — turn off to just follow along at
              your own pace.
            </li>
            <li>
              <strong>Show hints</strong> — highlight which key to press.
            </li>
            <li>
              <strong>Any octave</strong> — accept the right note in any octave
              (useful with the microphone).
            </li>
            <li>
              <strong>Listen</strong> — hear the piece played, with the notes
              lighting up.
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>🎹 3. Choose how you play</h2>
          <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
            <li>
              <strong>On-screen keyboard</strong> — click or tap the keys. On a
              computer you can also use your{" "}
              <span className="kbd">A</span> <span className="kbd">W</span>{" "}
              <span className="kbd">S</span> <span className="kbd">E</span>{" "}
              <span className="kbd">D</span> … keys, with{" "}
              <span className="kbd">Z</span>/<span className="kbd">X</span> to
              shift octave.
            </li>
            <li>
              <strong>MIDI keyboard</strong> — plug in a digital piano and click{" "}
              <em>Connect MIDI</em>. Most accurate.
            </li>
            <li>
              <strong>Microphone</strong> — play a real acoustic piano; Crescendo
              listens and detects the notes (best for single-note melodies).
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>📖 4. Learn to read the staff</h2>
          <p style={{ marginBottom: 0 }}>
            The <a href="#/read">Read Notes</a> trainer drills note-reading with
            flashcards on real notation. Start with treble lines &amp; spaces,
            then add ledger lines, the bass clef, both clefs together, and
            sharps. Answer by clicking the note name or by playing it on the
            keyboard — building the link between the page and your fingers.
          </p>
        </div>

        <div className="card">
          <h2>🎓 5. Ask Maestro, your AI teacher</h2>
          <p>
            The <a href="#/teacher">Professeur</a> page is a built-in AI piano
            teacher named <strong>Maestro</strong> who{" "}
            <strong>speaks French only</strong>. Ask anything about reading
            notes, rhythm, fingering, or playing technique — Maestro can see
            which piece you’re practising and where you are in it, so the advice
            is specific to your situation.
          </p>
          <p style={{ marginBottom: 0 }}>
            Maestro is powered by Anthropic’s Claude. Add your Anthropic API key
            on the Professeur page (stored only in your browser) to turn it on,
            or wire up a backend via the <code>VITE_INSTRUCTOR_PROXY</code>{" "}
            environment variable to keep the key server-side.
          </p>
        </div>

        <div className="banner warn">
          <span>💡</span>
          <span>
            Tip: turn on <strong>Use microphone</strong> only when you need it —
            it listens continuously while enabled. Audio starts after your first
            tap or key press (browsers require a gesture before playing sound).
          </span>
        </div>
      </div>
    </div>
  );
}
