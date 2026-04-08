import { canvas, SETTINGS, state } from "./js/core.js";
import { bootstrapAsciiSource, refreshAsciiList, resizeCanvas, rotateAscii } from "./js/ascii.js";
import { requestAudioStartOnGesture, startWallpaperEngineAudio } from "./js/audio.js";
import { animate } from "./js/render.js";

canvas.addEventListener("mousemove", (event) => {
  state.mouse.x = event.clientX;
  state.mouse.y = event.clientY;
  state.mouse.active = true;
});

canvas.addEventListener("mouseleave", () => {
  state.mouse.active = false;
});

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!event.touches[0]) return;
    state.mouse.x = event.touches[0].clientX;
    state.mouse.y = event.touches[0].clientY;
    state.mouse.active = true;
  },
  { passive: true }
);

canvas.addEventListener("touchend", () => {
  state.mouse.active = false;
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
bootstrapAsciiSource();
startWallpaperEngineAudio();
requestAudioStartOnGesture();

setInterval(() => {
  refreshAsciiList();
}, SETTINGS.rescanIntervalMs);

setInterval(() => {
  rotateAscii();
}, SETTINGS.rotateIntervalMs);

animate();
