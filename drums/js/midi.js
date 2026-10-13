import { NITRO_MAX, elementLabel } from "./kit.js";

export function createMidi({ onNote, onStatus }) {
  let access = null;

  function report(extra = {}) {
    const inputs = access ? [...access.inputs.values()] : [];
    let state = "idle";
    if (!navigator.requestMIDIAccess) state = "unsupported";
    else if (extra.denied) state = "denied";
    else if (access && inputs.length) state = "connected";
    else if (access) state = "waiting";
    onStatus({
      state,
      inputs: inputs.map((input) => input.name || "MIDI input"),
      message: extra.message || "",
    });
  }

  function bind() {
    if (!access) return;
    for (const input of access.inputs.values()) {
      input.onmidimessage = (event) => {
        const [status, note, velocity] = event.data;
        const command = status & 0xf0;
        if (command !== 0x90 || velocity <= 0) return;
        const known = Object.prototype.hasOwnProperty.call(NITRO_MAX, note);
        const element = known ? NITRO_MAX[note] : undefined;
        onNote({
          note,
          velocity,
          element,
          label: known ? elementLabel(element) : `Note ${note}`,
        });
      };
    }
    report();
  }

  async function connect() {
    if (!navigator.requestMIDIAccess) {
      report();
      return;
    }
    try {
      access = await navigator.requestMIDIAccess();
      access.onstatechange = bind;
      bind();
    } catch (error) {
      report({ denied: true, message: error.message || "MIDI permission was blocked." });
    }
  }

  return { connect };
}
