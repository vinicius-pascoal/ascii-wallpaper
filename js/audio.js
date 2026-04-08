import { SETTINGS, clamp, state } from "./core.js";

export function updateAudioMetrics() {
  const audio = state.audio;

  if (!audio.active || !audio.data) {
    audio.level += (0 - audio.level) * 0.04;
    audio.bass += (0 - audio.bass) * 0.04;
    audio.mid += (0 - audio.mid) * 0.04;
    audio.treble += (0 - audio.treble) * 0.04;
    audio.beat += (0 - audio.beat) * 0.08;
    return;
  }

  let normalized = audio.data;

  if (audio.analyser) {
    audio.analyser.getByteFrequencyData(audio.data);
    normalized = audio.data;
  }

  const totalBins = normalized.length || 1;
  const bassEnd = Math.max(4, Math.floor(totalBins * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(totalBins * 0.42));

  let bass = 0;
  let mid = 0;
  let treble = 0;

  for (let i = 0; i < bassEnd; i++) {
    bass += normalized[i];
  }

  for (let i = bassEnd; i < midEnd; i++) {
    mid += normalized[i];
  }

  for (let i = midEnd; i < totalBins; i++) {
    treble += normalized[i];
  }

  bass /= bassEnd;
  mid /= Math.max(1, midEnd - bassEnd);
  treble /= Math.max(1, totalBins - midEnd);

  if (bass > 1 || mid > 1 || treble > 1) {
    bass /= 255;
    mid /= 255;
    treble /= 255;
  }

  const energy = clamp((bass * 0.5) + (mid * 0.33) + (treble * 0.17), 0, 1);

  audio.bass += (bass - audio.bass) * (1 - SETTINGS.audioSmoothing);
  audio.mid += (mid - audio.mid) * (1 - SETTINGS.audioSmoothing);
  audio.treble += (treble - audio.treble) * (1 - SETTINGS.audioSmoothing);
  audio.level += (energy - audio.level) * (1 - SETTINGS.audioSmoothing);

  const now = performance.now();
  const beatReady = audio.bass > SETTINGS.audioBeatThreshold && (now - audio.lastBeatAt) > SETTINGS.audioBeatCooldownMs;

  if (beatReady) {
    audio.lastBeatAt = now;
    audio.beat = 1;
  } else {
    audio.beat += (0 - audio.beat) * 0.1;
  }
}

function setAudioData(audioArray) {
  const audio = state.audio;

  if (!audioArray || typeof audioArray.length !== "number" || audioArray.length === 0) {
    audio.active = false;
    return;
  }

  audio.data = audioArray;
  audio.active = true;
  audio.ready = true;
}

export function startWallpaperEngineAudio() {
  if (!state.audio.enabled || typeof window.wallpaperRegisterAudioListener !== "function") {
    return false;
  }

  state.audio.mode = "wallpaper-engine";
  state.audio.ready = true;
  state.audio.active = true;

  window.wallpaperRegisterAudioListener((audioArray) => {
    setAudioData(audioArray);
  });

  return true;
}

export function getAudioIntensity() {
  return clamp(state.audio.level, 0, 1);
}

export function getAudioBeatPulse() {
  return clamp(state.audio.beat, 0, 1);
}

export function getShapeLoss() {
  const audio = state.audio;
  return clamp((getAudioIntensity() * 0.7) + (audio.bass * 0.3), 0, 1);
}

async function startMicrophoneAudio() {
  const audio = state.audio;

  if (!audio.enabled || audio.active || audio.mode === "wallpaper-engine") {
    return;
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();

    analyser.fftSize = SETTINGS.audioFftSize;
    analyser.smoothingTimeConstant = 0.72;

    source.connect(analyser);

    audio.stream = stream;
    audio.context = context;
    audio.source = source;
    audio.analyser = analyser;
    audio.data = new Uint8Array(analyser.frequencyBinCount);
    audio.mode = "microphone";
    audio.active = true;
    audio.ready = true;
  } catch {
    audio.enabled = false;
    audio.active = false;
  }
}

export function requestAudioStartOnGesture() {
  if (!SETTINGS.audioRequestOnFirstGesture || !state.audio.enabled || state.audio.mode === "wallpaper-engine") {
    return;
  }

  const handler = () => {
    void startMicrophoneAudio();
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
  };

  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("keydown", handler, true);
}
