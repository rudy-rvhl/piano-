import { useEffect, useState } from "react";
import { enableMidi, subscribeMidi, type MidiState } from "../lib/midi";
import {
  enableMic,
  disableMic,
  subscribeMic,
  type MicState,
} from "../lib/mic";
import { initAudio, isAudioReady, isUsingSampler } from "../lib/audio";
import { midiToName } from "../lib/notes";

export default function InputControls() {
  const [midi, setMidi] = useState<MidiState>();
  const [mic, setMic] = useState<MicState>();
  const [audioLabel, setAudioLabel] = useState("Tap a key to start sound");

  useEffect(() => subscribeMidi(setMidi), []);
  useEffect(() => subscribeMic(setMic), []);

  useEffect(() => {
    const t = setInterval(() => {
      if (isAudioReady()) {
        setAudioLabel(isUsingSampler() ? "Grand piano" : "Synth piano");
      }
    }, 800);
    return () => clearInterval(t);
  }, []);

  const centsLeft = mic?.liveMidi != null ? 50 + (mic.cents ?? 0) : 50;
  const inTune = Math.abs(mic?.cents ?? 99) <= 8;

  return (
    <div className="input-panel">
      <button
        className="btn btn-sm"
        onClick={() => initAudio()}
        title="Audio engine"
      >
        🔊 {audioLabel}
      </button>

      {midi?.supported && (
        <button
          className={`btn btn-sm ${midi.enabled ? "" : "btn-ghost"}`}
          onClick={() => enableMidi()}
        >
          🎹 {midi.enabled
            ? midi.inputs.length
              ? midi.inputs[0]
              : "MIDI on (no device)"
            : "Connect MIDI"}
        </button>
      )}

      <button
        className={`btn btn-sm ${mic?.enabled ? "" : "btn-ghost"}`}
        onClick={() => (mic?.enabled ? disableMic() : enableMic())}
      >
        🎤 {mic?.enabled ? "Mic listening" : "Use microphone"}
      </button>

      {mic?.enabled && (
        <div className="tuner">
          <span style={{ minWidth: 42 }}>
            {mic.liveMidi != null ? midiToName(mic.liveMidi) : "—"}
          </span>
          <div className="needle">
            <div
              className="dot"
              style={{
                left: `${Math.max(0, Math.min(100, centsLeft))}%`,
                background: inTune ? "var(--good)" : "var(--gold)",
              }}
            />
          </div>
        </div>
      )}

      {mic?.error && <span className="badge dim">⚠ {mic.error}</span>}
    </div>
  );
}
