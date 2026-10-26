/*
  Plays Strudel in a child frame so its globals never
  replace p5 functions such as floor, color, and loop.
*/

import { buildBeat, rootMidiFromColor } from "./beats.mjs";

const frame = document.createElement("iframe");
frame.id = "strudel-frame";
frame.title = "Strudel playback";
frame.src = "strudel-frame.html";
frame.setAttribute("allow", "autoplay");
document.body.appendChild(frame);

let pending = null;
let tail = Promise.resolve();

const ready = new Promise((resolve, reject) => {
  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) {
      return;
    }

    const data = event.data;

    if (!data || data.source !== "polyomino-beats") {
      return;
    }

    if (data.type === "status" && data.status === "ready") {
      resolve();
    }

    if (data.type === "error" && pending === null && data.status !== "playing") {
      reject(new Error(data.message || "Strudel failed to load"));
    }

    if (!pending) {
      return;
    }

    const current = pending;
    pending = null;

    if (data.type === "error") {
      current.reject(new Error(data.message || "Strudel failed"));
      return;
    }

    current.resolve(data);
  });
});

function unlock() {
  const child = frame.contentWindow;

  if (!child || !child.polyominoUnlock) {
    return;
  }

  try {
    child.polyominoUnlock();
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener("pointerdown", () => {
  unlock();
}, true);

function playNow(code) {
  const child = frame.contentWindow;

  return new Promise((resolve, reject) => {
    pending = { resolve, reject };

    child.postMessage(
      {
        source: "polyomino-beats",
        type: "play",
        code
      },
      location.origin
    );
  });
}

function play(code) {
  unlock();
  const run = tail.then(() => playNow(code));
  tail = run.then(() => {}, () => {});
  return run;
}

function stop() {
  const child = frame.contentWindow;

  if (!child) {
    return Promise.resolve();
  }

  child.postMessage(
    {
      source: "polyomino-beats",
      type: "stop"
    },
    location.origin
  );

  return Promise.resolve();
}

window.PolyominoBeats = {
  buildBeat,
  rootMidiFromColor
};

window.PolyominoPlayer = {
  ready,
  play,
  stop,
  unlock
};
