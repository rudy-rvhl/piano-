// Web MIDI input. Connects to any attached MIDI keyboard and forwards note
// on/off into the shared note bus. Gracefully no-ops where Web MIDI is missing
// (Safari/Firefox without the flag) so the rest of the app keeps working.

import { noteBus } from "./noteBus";

export interface MidiState {
  supported: boolean;
  enabled: boolean;
  inputs: string[];
  error?: string;
}

type Listener = (s: MidiState) => void;

let access: MIDIAccess | null = null;
const listeners = new Set<Listener>();
let state: MidiState = {
  supported:
    typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  enabled: false,
  inputs: [],
};

function emit() {
  listeners.forEach((l) => l(state));
}

export function subscribeMidi(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function getMidiState(): MidiState {
  return state;
}

function handleMessage(ev: MIDIMessageEvent) {
  const data = ev.data;
  if (!data || data.length < 2) return;
  const status = data[0] & 0xf0;
  const note = data[1];
  const velocity = data.length > 2 ? data[2] : 0;

  if (status === 0x90 && velocity > 0) {
    noteBus.noteOn(note, velocity / 127, "midi");
  } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
    noteBus.noteOff(note, "midi");
  }
}

function wireInputs() {
  if (!access) return;
  const names: string[] = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = handleMessage;
    names.push(input.name ?? "MIDI device");
  });
  state = { ...state, inputs: names };
  emit();
}

export async function enableMidi(): Promise<MidiState> {
  if (!state.supported) {
    state = { ...state, error: "Web MIDI is not supported in this browser." };
    emit();
    return state;
  }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = wireInputs;
    wireInputs();
    state = { ...state, enabled: true, error: undefined };
    emit();
  } catch (err) {
    state = {
      ...state,
      enabled: false,
      error: err instanceof Error ? err.message : "Could not access MIDI.",
    };
    emit();
  }
  return state;
}
