# 🎹 Crescendo — Learn Piano Your Way

A Skoove-style interactive piano tutor that you feed with **your own sheet
music**. Crescendo renders your scores, highlights each note on the staff **and**
on a keyboard, and waits for you to play it correctly before moving on — so you
learn to **read** and **play** at the same time. It also includes a dedicated
note-reading trainer and a built-in **AI piano teacher who speaks French**.

> Upload a MusicXML file → press **Start** → play the highlighted notes on your
> MIDI keyboard, your microphone, or the on-screen keys. Crescendo follows along
> and tracks your accuracy.

---

## ✨ Features

- **Upload your own music sheets** — drag-and-drop `.musicxml`, `.xml`, or
  compressed `.mxl` files (MuseScore's default export). Scores are stored
  privately in your browser (IndexedDB); nothing is uploaded to a server.
- **Interactive "wait" practice** — the core Skoove mechanic. The score's cursor
  highlights the next note(s); the matching piano key glows. Play it right and it
  turns green and advances; play a wrong note and it flashes red. You never get
  lost.
- **Listen mode** — hear any piece played back with the notes lighting up.
- **Note-reading trainer** — flashcards on real engraved notation. Progressive
  levels: treble lines & spaces → ledger lines → bass clef → both clefs →
  sharps. Answer by **naming** the note or by **playing** it.
- **🎓 Maestro — your AI piano teacher (in French)** — a context-aware tutor
  powered by Claude. It knows which piece you're practising and where you are in
  it, and answers your questions about reading notes, rhythm, fingering and
  technique — **entirely in French**.
- **Play any way you like** — on-screen keyboard (mouse/touch, plus your computer
  `A`–`K` keys), a real **MIDI keyboard** (Web MIDI), or an acoustic piano via
  the **microphone** (pitch detection).
- **Progress tracking** — best accuracy per piece, practice counts, and reading
  stats.
- Ships with public-domain sample songs (Ode to Joy, Twinkle, Für Elise opening,
  scales, a bass-clef study) so it's useful immediately.

---

## 🚀 Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Build / preview a production bundle:

```bash
npm run build
npm run preview  # http://localhost:4173
```

Type-check only:

```bash
npm run typecheck
```

---

## 🎼 Where do I get MusicXML?

MusicXML is the universal sheet-music format and it's free:

- Open any piece in **MuseScore** (free) → _File → Export → MusicXML_.
- Download from **musescore.com**, IMSLP, or other free MusicXML libraries.
- Most notation apps (Finale, Sibelius, Dorico, Flat.io) export MusicXML too.

Crescendo needs MusicXML (not PDF/images) because the interactive teaching —
highlight-and-wait, follow-along, per-note feedback — requires machine-readable
notation.

---

## 🎓 Enabling the AI teacher (Maestro)

Maestro is powered by Anthropic's **Claude** (`claude-opus-4-8`). Because
Crescendo is a static web app, there are two ways to connect it:

1. **Bring your own key (default).** Open the **Professeur** page and paste your
   Anthropic API key. It's stored **only in your browser** (`localStorage`) and
   is sent only to Anthropic's API. Get a key at
   <https://console.anthropic.com/settings/keys>.
2. **Backend proxy (recommended for production).** Set the build-time env var
   `VITE_INSTRUCTOR_PROXY` to an endpoint that forwards `{ system, messages }`
   to the Claude Messages API and returns `{ "text": "..." }`. The app prefers
   this automatically and never touches the key in the browser.

   ```bash
   VITE_INSTRUCTOR_PROXY=/api/instructor npm run build
   ```

Maestro always replies in **French**, regardless of the language you type in.

---

## 🛠️ Tech stack

- **React + TypeScript + Vite**
- **OpenSheetMusicDisplay** (MusicXML rendering + practice cursor)
- **Tone.js** (piano sound — sampled grand with a synth fallback)
- **pitchy** (microphone pitch detection) · **Web MIDI** (hardware keyboards)
- **Zustand** (state) · **idb-keyval** (score storage) · **fflate** (`.mxl`)
- **@anthropic-ai/sdk** (the AI teacher)

---

## 📁 Project structure

```
src/
  lib/
    notes.ts            music-theory helpers (MIDI ↔ names, staff placement)
    noteBus.ts          unified note-input event bus (screen / MIDI / mic)
    audio.ts            Tone.js piano engine
    midi.ts             Web MIDI input
    mic.ts              microphone pitch detection
    scoreEngine.ts      OSMD wrapper + practice-step extraction + cursor
    usePractice.ts      wait-mode + playback engine (the core loop)
    musicxmlBuilder.ts  generate MusicXML from note arrays (for samples)
    samples.ts          public-domain seed songs
    storage.ts          IndexedDB score library + upload parsing
    readingStats.ts     reading-trainer stats
    instructor.ts       the French AI teacher (Claude integration)
  components/
    Piano.tsx           interactive on-screen keyboard
    ScoreView.tsx       OSMD renderer
    FlashStaff.tsx      single-note staff for the reading trainer
    InputControls.tsx   MIDI / mic toggles + live tuner
  pages/
    LibraryPage · PracticePage · ReadingPage · TeacherPage · ProgressPage · HelpPage
  store/                settings + live instructor context (Zustand)
```

---

## ℹ️ Notes & limitations

- Audio starts after your first tap/click (browsers require a user gesture).
- The sampled grand piano loads from a CDN; offline, it falls back to a synth.
- Microphone detection is monophonic — great for single-note melodies, less so
  for dense chords. Use **MIDI** for chord-heavy pieces.
- Image/PDF scores aren't interactive (that would need optical music
  recognition). Convert them to MusicXML first (see above).
